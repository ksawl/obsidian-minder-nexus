import {
    App,
    Editor,
    SuggestModal,
    prepareFuzzySearch
} from 'obsidian';
import NexusPlugin from '../main';

/**
 * Модальное окно для быстрой вставки семантического типа через Command Palette / горячую клавишу.
 * 
 * Умная вставка:
 * - Если курсор внутри [[...| → вставляет type]] (alias синтаксис)
 * - Иначе → вставляет type:: (dataview синтаксис)
 */
export class TypePickerModal extends SuggestModal<string> {
    plugin: NexusPlugin;
    editor: Editor;

    constructor(app: App, plugin: NexusPlugin, editor: Editor) {
        super(app);
        this.plugin = plugin;
        this.editor = editor;
        this.setPlaceholder('Choose a semantic relation type...');
    }

    /**
     * Возвращает список подходящих типов на основе ввода в модальном окне
     */
    getSuggestions(query: string): string[] {
        const types = this.plugin.settings.semantic.trustedTypes;

        if (!query) return types;

        const search = prepareFuzzySearch(query.toLowerCase());
        return types
            .map(type => ({ type, result: search(type) }))
            .filter(item => item.result)
            .sort((a, b) => b.result!.score - a.result!.score)
            .map(item => item.type);
    }

    /**
     * Рендерит элемент в списке подсказок модального окна
     */
    renderSuggestion(value: string, el: HTMLElement): void {
        el.createDiv({ text: value, cls: 'nexus-picker-item' });
    }

    /**
     * Обрабатывает выбор типа.
     * Определяет контекст курсора и вставляет в нужном синтаксисе.
     */
    onChooseSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);

        // Проверяем, находимся ли мы внутри [[ — alias синтаксис
        const insideWikiLink = beforeCursor.includes('[[') && !beforeCursor.includes(']]');

        if (insideWikiLink) {
            // Внутри [[Note — вставляем |type]]
            const afterCursor = line.substring(cursor.ch);
            const hasClosing = afterCursor.startsWith(']]');

            const replacement = `|${value}${hasClosing ? '' : ']]'}`;
            this.editor.replaceRange(replacement, cursor);

            const newCh = cursor.ch + replacement.length;
            this.editor.setCursor({ line: cursor.line, ch: newCh });
        } else {
            // Вне wiki-ссылки — вставляем type:: 
            const replacement = `${value}:: `;
            this.editor.replaceRange(replacement, cursor);

            const newCh = cursor.ch + replacement.length;
            this.editor.setCursor({ line: cursor.line, ch: newCh });
        }
    }
}
