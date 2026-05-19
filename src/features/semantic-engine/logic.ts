import { INexusLink, LinkSyntax } from "../../core/types";

export class ParserLogic {
    // M1 FIX: Кеш скомпилированных regex — инвалидируется при изменении trustedTypes
    private static cachedTypesKey: string = '';
    private static cachedAliasRegex: RegExp | null = null;
    private static cachedDataviewRegex: RegExp | null = null;

    /**
     * Парсит текст и находит все семантические связи
     */
    static parseText(
        text: string, 
        sourcePath: string, 
        trustedTypes: string[],
        options: { alias: boolean, dataview: boolean }
    ): INexusLink[] {
        if (trustedTypes.length === 0) return [];

        const links: INexusLink[] = [];

        // Очищаем текст от блоков кода и frontmatter перед парсингом
        const cleanText = this.prepareTextForParsing(text);

        // M1 FIX: Пересобираем regex только при изменении trustedTypes
        const typesKey = trustedTypes.join('|');
        if (typesKey !== this.cachedTypesKey) {
            const typesPattern = trustedTypes
                .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            this.cachedAliasRegex = new RegExp(`\\[\\[([^|\\]\\n]+)\\|(${typesPattern})\\]\\]`, 'g');
            this.cachedDataviewRegex = new RegExp(`(?:^|\\s|[\\(\\[])(${typesPattern})::\\s*\\[\\[([^\\]\\n]+)\\]\\]`, 'g');
            this.cachedTypesKey = typesKey;
        }

        // 1. Парсинг [[Note|type]] (Semantic Alias)
        if (options.alias && this.cachedAliasRegex) {
            // Сброс lastIndex для повторного использования regex с флагом 'g'
            this.cachedAliasRegex.lastIndex = 0;
            let match;
            while ((match = this.cachedAliasRegex.exec(cleanText)) !== null) {
                links.push({
                    sourcePath,
                    targetPath: match[1].trim(),
                    type: match[2].trim(),
                    syntax: LinkSyntax.SemanticAlias,
                    position: {
                        start: match.index,
                        end: match.index + match[0].length
                    },
                    rawValue: match[0]
                });
            }
        }

        // 2. Парсинг type:: [[Note]] (Dataview Inline)
        if (options.dataview && this.cachedDataviewRegex) {
            this.cachedDataviewRegex.lastIndex = 0;
            let match;
            while ((match = this.cachedDataviewRegex.exec(cleanText)) !== null) {
                const fullMatch = match[0];
                const type = match[1];
                const targetPath = match[2].trim();
                
                // Находим реальное начало типа внутри совпадения
                const typeOffset = fullMatch.indexOf(type);
                
                links.push({
                    sourcePath,
                    targetPath,
                    type,
                    syntax: LinkSyntax.DataviewInline,
                    position: {
                        start: match.index + typeOffset,
                        end: match.index + fullMatch.length
                    },
                    rawValue: fullMatch.substring(typeOffset)
                });
            }
        }

        return links;
    }

    /**
     * Удаляет блоки кода и frontmatter, заменяя их пробелами (чтобы сохранить индексы)
     */
    private static prepareTextForParsing(text: string): string {
        let processed = text;

        // 1. Маскируем frontmatter
        processed = processed.replace(/^---[\s\S]*?---/, (match) => ' '.repeat(match.length));

        // 2. Маскируем блоки кода (```...```)
        processed = processed.replace(/```[\s\S]*?```/g, (match) => ' '.repeat(match.length));

        // 3. Маскируем инлайновые блоки кода (`...`)
        processed = processed.replace(/`[^`\n]+`/g, (match) => ' '.repeat(match.length));

        return processed;
    }
}
