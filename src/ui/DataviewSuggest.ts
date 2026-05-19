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
 * Автодополнение для Dataview inline field синтаксиса.
 * Срабатывает при наборе текста в начале строки (или после пробела),
 * если набранное слово fuzzy-матчится с одним из trustedTypes.
 * 
 * Пример: пользователь набирает "sup" → подсказка "supports"
 * При выборе вставляется "supports:: " с курсором после пробела.
 */
export class DataviewSuggest extends EditorSuggest<string> {
    plugin: NexusPlugin;

    constructor(app: App, plugin: NexusPlugin) {
        super(app);
        this.plugin = plugin;
    }

    /**
     * Проверяет, нужно ли показывать подсказки для Dataview синтаксиса.
     * 
     * Триггеры:
     * - Слово в начале строки или после пробела
     * - Минимум 2 символа
     * - Строка НЕ содержит "::" (тип уже введён)
     * - Строка НЕ содержит "[[" перед курсором (это alias-территория SemanticSuggest)
     */
    onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile): EditorSuggestTriggerInfo | null {
        if (!this.plugin.settings.enableModules.semantic) return null;
        if (!this.plugin.settings.semantic.syntaxOptions.dataview) return null;

        const line = editor.getLine(cursor.line);

        // Не триггерим если строка уже содержит "::" — тип уже введён
        if (line.includes('::')) return null;

        // Не триггерим если курсор внутри wiki-ссылки [[ — это территория SemanticSuggest
        const beforeCursor = line.substring(0, cursor.ch);
        if (beforeCursor.includes('[[')) return null;

        // Ищем слово перед курсором: либо в самом начале строки, либо после пробела
        const match = beforeCursor.match(/(^|\s)([a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*)$/);

        if (!match) return null;

        const query = match[2];

        // Минимум 2 символа для триггера — иначе будет срабатывать слишком часто
        if (query.length < 2) return null;

        // Проверяем, начинается ли хотя бы один trustedType с набранного текста
        const queryLower = query.toLowerCase();
        const hasMatch = this.plugin.settings.semantic.trustedTypes.some(
            type => type.toLowerCase().startsWith(queryLower)
        );

        if (!hasMatch) return null;

        return {
            start: { line: cursor.line, ch: cursor.ch - query.length },
            end: cursor,
            query
        };
    }

    /**
     * Возвращает список подходящих типов на основе ввода пользователя
     */
    getSuggestions(context: EditorSuggestContext): string[] {
        const query = context.query.toLowerCase();
        const types = this.plugin.settings.semantic.trustedTypes;

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
        div.createSpan({ text: 'Dataview: ', cls: 'nexus-suggest-label' });
        div.createSpan({ text: `${value}:: `, cls: 'nexus-suggest-value' });
    }

    /**
     * Обрабатывает выбор подсказки.
     * Вставляет "type:: " и ставит курсор после пробела для ввода [[Note]].
     */
    selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
        const { editor, start, end } = this.context!;

        const replacement = `${value}:: `;
        editor.replaceRange(replacement, start, end);

        // Ставим курсор после "type:: " для ввода [[Note]]
        const newCh = start.ch + replacement.length;
        editor.setCursor({ line: end.line, ch: newCh });
    }
}
