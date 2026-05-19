import { 
    Decoration, 
    DecorationSet, 
    EditorView, 
    ViewPlugin, 
    ViewUpdate,
    WidgetType
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { EventRef, editorLivePreviewField, TFile } from "obsidian";
import NexusPlugin from "../main";
import { ParserLogic } from "./semantic-engine/logic";
import { LinkSyntax } from "../core/types";

interface WorkspaceWithCustomEvents {
    on(name: string, callback: () => void, ctx?: unknown): EventRef;
}

interface MarkdownLeafView {
    editor?: { cm: EditorView };
    file?: TFile | null;
}

/**
 * StateEffect для явного сигнала пересборки декораций при смене настроек.
 * Это документированный и стабильный способ в CM6 API.
 */
export const nexusRefreshEffect = StateEffect.define<null>();

/**
 * Виджет-бейдж для dataview-ссылок type:: [[Note]].
 * Показывает тип связи как badge после ссылки.
 */
class NexusBadgeWidget extends WidgetType {
    constructor(
        readonly type: string, 
        readonly isDead: boolean = false
    ) {
        super();
    }

    toDOM() {
        const span = activeDocument.createSpan();
        span.className = "nexus-badge-widget";
        span.classList.add(`nexus-type-${this.type.replace(/\s+/g, '-').toLowerCase()}`);
        if (this.isDead) span.classList.add("is-dead");
        span.textContent = this.type.toUpperCase();
        return span;
    }

    eq(other: NexusBadgeWidget) {
        return other.type === this.type && other.isDead === this.isDead;
    }
}

/**
 * Виджет-замена для alias-ссылок [[Note|type]].
 * 
 * Obsidian нативно показывает alias ("type") как текст ссылки.
 * Этот виджет ЗАМЕНЯЕТ весь блок [[Note|type]] на:
 *   кликабельную ссылку "Note" + бейдж "SUPPORTS"
 * 
 * Когда курсор входит в зону ссылки — замена снимается,
 * и пользователь видит сырой markdown для редактирования.
 */
class NexusLinkWidget extends WidgetType {
    constructor(
        readonly targetName: string,
        readonly targetPath: string,
        readonly type: string,
        readonly isDead: boolean,
        readonly sourcePath: string,
        private readonly openLink: (path: string, sourcePath: string) => void,
        private readonly triggerHover: (event: MouseEvent, targetEl: HTMLElement, linktext: string, sourcePath: string) => void
    ) {
        super();
    }

    toDOM() {
        const container = activeDocument.createSpan();
        container.className = "nexus-link-replaced";

        // Кликабельная ссылка на целевую заметку
        const link = activeDocument.createEl("a");
        link.className = "internal-link";
        link.setAttribute("data-href", this.targetPath);
        link.setAttribute("data-tooltip-position", "top");
        if (this.isDead) link.classList.add("is-unresolved");
        link.textContent = this.targetName;

        // Click → навигация к заметке
        link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openLink(this.targetPath, this.sourcePath);
        });

        // Hover → превью содержимого заметки (Page Preview)
        link.addEventListener("mouseover", (e) => {
            this.triggerHover(e, link, this.targetPath, this.sourcePath);
        });

        container.appendChild(link);

        // Бейдж с типом связи
        const badge = activeDocument.createSpan();
        badge.className = `nexus-badge-widget nexus-type-${this.type.replace(/\s+/g, '-').toLowerCase()}`;
        if (this.isDead) badge.classList.add("is-dead");
        badge.textContent = this.type.toUpperCase();
        container.appendChild(badge);

        return container;
    }

    eq(other: NexusLinkWidget) {
        return other.targetName === this.targetName
            && other.targetPath === this.targetPath
            && other.type === this.type
            && other.isDead === this.isDead;
    }

    // Пропускаем события мыши к редактору — клик вне ссылки поставит курсор
    ignoreEvent(e: Event) {
        // Клики на ссылке (навигация) обрабатываем сами
        if (e.type === 'mousedown' && (e.target as HTMLElement)?.classList?.contains('internal-link')) {
            return true;
        }
        return false;
    }
}

export const livePreviewExtension = (plugin: NexusPlugin) => {
    // Функция навигации — передаётся в виджет через замыкание
    const openLink = (path: string, sourcePath: string) => {
        void plugin.app.workspace.openLinkText(path, sourcePath);
    };

    // Функция hover preview — триггерит нативный Page Preview Obsidian.
    // source: 'preview' — зарегистрированный source, который page-preview плагин принимает.
    // hoverParent: объект с hoverPopover — минимальный интерфейс HoverParent.
    const triggerHover = (event: MouseEvent, targetEl: HTMLElement, linktext: string, sourcePath: string) => {
        plugin.app.workspace.trigger('hover-link', {
            event,
            source: 'preview',
            hoverParent: { hoverPopover: null },
            targetEl,
            linktext,
            sourcePath
        });
    };

    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        private eventRef: EventRef;
        private lastSourcePath: string = '';

        constructor(public view: EditorView) {
            this.decorations = this.buildDecorations(view);
            
            // Слушаем nexus:refresh — теперь диспатчим StateEffect для гарантированного rebuild
            this.eventRef = (plugin.app.workspace as unknown as WorkspaceWithCustomEvents).on('nexus:refresh', () => {
                // StateEffect — документированный способ форсировать пересборку декораций.
                // CM6 гарантирует что после этого вызовется update() с effects в транзакции.
                this.view.dispatch({
                    effects: nexusRefreshEffect.of(null)
                });
            });

            // Прямой DOM listener для hover preview на нативных ссылках (dataview-синтаксис)
            this.view.dom.addEventListener('mouseover', this.handleHoverPreview);
        }

        update(update: ViewUpdate) {
            const currentPath = this.getSourcePath(update.view);
            const fileSwitched = currentPath !== this.lastSourcePath;
            const modeChanged = update.startState.field(editorLivePreviewField) !== 
                                update.state.field(editorLivePreviewField);

            // КЛЮЧЕВОЙ ФИКс: Проверяем наличие nexusRefreshEffect в транзакции.
            // Это срабатывает когда пользователь меняет настройки (syntaxOptions, trustedTypes).
            const settingsChanged = update.transactions.some(tr => 
                tr.effects.some(e => e.is(nexusRefreshEffect))
            );

            // selectionSet — перестраиваем при движении курсора,
            // чтобы снимать/ставить Decoration.replace когда курсор входит/выходит из ссылки
            if (update.docChanged || update.selectionSet || fileSwitched || modeChanged || settingsChanged) {
                this.lastSourcePath = currentPath;
                this.decorations = this.buildDecorations(update.view);
            }
        }

        destroy() {
            this.view.dom.removeEventListener('mouseover', this.handleHoverPreview);
            if (this.eventRef) {
                plugin.app.workspace.offref(this.eventRef);
            }
        }

        /**
         * Hover preview handler для нативных [[Note]] ссылок в Live Preview.
         * Перехватывает mouseover на любых internal-link элементах CM6
         * и вручную триггерит hover-link для page-preview плагина.
         */
        private handleHoverPreview = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Широкий набор селекторов — Obsidian использует разные классы в разных версиях
            const linkEl = target.closest('.cm-hmd-internal-link') as HTMLElement
                || target.closest('.cm-underline')?.closest('.cm-hmd-internal-link') as HTMLElement
                || target.closest('.internal-link') as HTMLElement;

            if (!linkEl) return;

            // Не перехватываем hover на наших собственных replaced-виджетах (alias-ссылки)
            // — у них свой собственный mouseover listener
            if (linkEl.closest('.nexus-link-replaced')) return;

            // Определяем позицию в документе по координатам мыши
            const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null) return;

            // Ищем [[...]] вокруг этой позиции на текущей строке
            const line = this.view.state.doc.lineAt(pos);
            const lineText = line.text;
            const lineOffset = pos - line.from;

            const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
            let match;
            while ((match = linkRegex.exec(lineText)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                if (lineOffset >= start && lineOffset <= end) {
                    const linktext = match[1];
                    triggerHover(event, linkEl, linktext, this.lastSourcePath);
                    return;
                }
            }
        };

        /**
         * Получаем sourcePath из самого EditorView через итерацию листов воркспейса.
         * Гарантирует корректный resolve даже для неактивных вкладок.
         */
        private getSourcePath(view: EditorView): string {
            let sourcePath = '';
            plugin.app.workspace.iterateAllLeaves(leaf => {
                const leafView = leaf.view as MarkdownLeafView;
                if (leafView?.editor?.cm === view) {
                    const file = (leaf.view as MarkdownLeafView).file;
                    if (file) sourcePath = file.path;
                }
            });
            return sourcePath;
        }

        buildDecorations(view: EditorView): DecorationSet {
            if (!plugin.settings.enableModules.semantic) {
                return Decoration.none;
            }

            // Скрываем бейджи в Source Mode
            const isLivePreview = view.state.field(editorLivePreviewField);
            if (!isLivePreview) {
                return Decoration.none;
            }

            const sourcePath = this.getSourcePath(view);
            const cursorPos = view.state.selection.main.head;
            
            const text = view.state.doc.toString();
            const trustedTypes = plugin.settings.semantic.trustedTypes;

            const links = ParserLogic.parseText(
                text, 
                sourcePath, 
                trustedTypes, 
                plugin.settings.semantic.syntaxOptions
            );

            // Собираем все декорации как массив {from, to, decoration}
            // чтобы отсортировать по позиции (CM6 требует строгий порядок)
            const decos: { from: number; to: number; deco: Decoration }[] = [];

            for (const link of links) {
                const targetFile = plugin.app.metadataCache.getFirstLinkpathDest(
                    link.targetPath, 
                    sourcePath
                );
                const isDead = !targetFile;
                const targetName = link.targetPath.split('/').pop()?.replace(/\.md$/, '') || link.targetPath;

                if (link.syntax === LinkSyntax.SemanticAlias) {
                    // [[Note|type]] — Decoration.replace заменяет весь блок
                    // НО: если курсор внутри ссылки — не заменяем, показываем raw markdown
                    const cursorInside = cursorPos >= link.position.start && cursorPos <= link.position.end;
                    
                    if (!cursorInside) {
                        decos.push({
                            from: link.position.start,
                            to: link.position.end,
                            deco: Decoration.replace({
                                widget: new NexusLinkWidget(
                                    targetName, 
                                    link.targetPath, 
                                    link.type, 
                                    isDead, 
                                    sourcePath,
                                    openLink,
                                    triggerHover
                                )
                            })
                        });
                    }
                } else {
                    // type:: [[Note]] — бейдж после ссылки
                    decos.push({
                        from: link.position.end,
                        to: link.position.end,
                        deco: Decoration.widget({
                            widget: new NexusBadgeWidget(link.type, isDead),
                            side: 1
                        })
                    });
                }
            }

            // CM6 требует декорации в строгом порядке возрастания позиции
            decos.sort((a, b) => a.from - b.from || a.to - b.to);

            const builder = new RangeSetBuilder<Decoration>();
            for (const { from, to, deco } of decos) {
                builder.add(from, to, deco);
            }

            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
};
