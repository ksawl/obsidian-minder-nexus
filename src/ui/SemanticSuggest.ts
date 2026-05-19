import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
    prepareFuzzySearch
} from 'obsidian';
import NexusPlugin from '../main';

/**
 * Автодополнение для семантических типов связей.
 * Срабатывает при вводе символа '|' внутри вики-ссылки [[...]]
 */
export class SemanticSuggest extends EditorSuggest<string> {
    plugin: NexusPlugin;

    constructor(app: App, plugin: NexusPlugin) {
        super(app);
        this.plugin = plugin;
    }

    /**
     * Проверяет, нужно ли показывать подсказки
     */
    onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile): EditorSuggestTriggerInfo | null {
        if (!this.plugin.settings.enableModules.semantic) return null;
        if (!this.plugin.settings.semantic.syntaxOptions.alias) return null;

        const line = editor.getLine(cursor.line);
        const sub = line.substring(0, cursor.ch);

        // Ищем открытую вики-ссылку с символом пайпа перед курсором: [[Note|
        // Регулярка: [[ , затем любые символы кроме [ и ], затем | , затем любые символы до конца подстроки
        const match = sub.match(/\[\[([^[\]]+)\|([^[\]]*)$/);
        
        if (match) {
            return {
                start: { line: cursor.line, ch: sub.lastIndexOf('|') + 1 },
                end: cursor,
                query: match[2]
            };
        }

        return null;
    }

    /**
     * Возвращает список подходящих типов на основе ввода пользователя
     */
    getSuggestions(context: EditorSuggestContext): string[] {
        const query = context.query.toLowerCase();
        const types = this.plugin.settings.semantic.trustedTypes;

        if (!query) return types;

        const search = prepareFuzzySearch(query);
        return types
            .map(type => ({ type, result: search(type) }))
            .filter(item => item.result)
            .sort((a, b) => b.result!.score - a.result!.score)
            .map(item => item.type);
    }

    /**
     * Рендерит элемент в списке подсказок
     */
    renderSuggestion(value: string, el: HTMLElement): void {
        el.addClass('nexus-suggest-item');
        const div = el.createDiv();
        div.createSpan({ text: 'Relation: ', cls: 'nexus-suggest-label' });
        div.createSpan({ text: value, cls: 'nexus-suggest-value' });
    }

    /**
     * Обрабатывает выбор подсказки
     */
    selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
        const { editor, start, end } = this.context!;
        
        // Вставляем выбранный тип. 
        // Мы также проверяем, есть ли закрывающие скобки после курсора, чтобы не дублировать их.
        const line = editor.getLine(end.line);
        const after = line.substring(end.ch);
        const hasClosing = after.startsWith(']]');

        const replacement = value + (hasClosing ? '' : ']]');
        editor.replaceRange(replacement, start, end);
        
        // Ставим курсор после вставленного типа (перед скобками или после них, если мы их добавили)
        const newCursorCh = start.ch + value.length + (hasClosing ? 0 : 2);
        editor.setCursor({ line: end.line, ch: newCursorCh });
    }
}
