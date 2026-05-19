import { ParserLogic } from "../logic";
import { LinkSyntax } from "../../../core/types";

describe('ParserLogic', () => {
    const trustedTypes = ['supports', 'contradicts', 'опровергает', 'поддерживает', 'part of'];
    const sourcePath = 'Source.md';
    const defaultOptions = { alias: true, dataview: true };

    // ==========================================
    // Существующие тесты (ядро парсера)
    // ==========================================

    test('should parse semantic aliases', () => {
        const text = 'This idea [[Target|supports]] the main theory.';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);

        expect(links).toHaveLength(1);
        expect(links[0].type).toBe('supports');
        expect(links[0].syntax).toBe(LinkSyntax.SemanticAlias);
    });

    test('should support types with spaces in Dataview', () => {
        const text = 'part of:: [[Target]]';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);

        expect(links).toHaveLength(1);
        expect(links[0].type).toBe('part of');
    });

    test('should ignore links inside code blocks', () => {
        const text = 'Normal [[A|supports]] and code ``` [[B|supports]] ```';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);

        expect(links).toHaveLength(1);
        expect(links[0].targetPath).toBe('A');
    });

    test('should ignore links inside frontmatter', () => {
        const text = '---\nsupports:: [[Hidden]]\n---\n[[Visible|supports]]';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);

        expect(links).toHaveLength(1);
        expect(links[0].targetPath).toBe('Visible');
    });

    test('should preserve correct positions after masking', () => {
        const text = '```code```\n[[Target|supports]]';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);

        expect(links).toHaveLength(1);
        // "[[Target|supports]]" начинается после "```code```\n" (10 + 1 = 11 символ)
        expect(links[0].position.start).toBe(11);
    });

    test('should handle multiple links and types', () => {
        const text = '[[A|supports]] and contradicts:: [[B]]';
        const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
        expect(links).toHaveLength(2);
    });

    test('should respect alias and dataview options', () => {
        const text = '[[A|supports]] and part of:: [[B]]';
        
        const noAlias = ParserLogic.parseText(text, sourcePath, trustedTypes, { alias: false, dataview: true });
        expect(noAlias).toHaveLength(1);
        expect(noAlias[0].syntax).toBe(LinkSyntax.DataviewInline);

        const noDV = ParserLogic.parseText(text, sourcePath, trustedTypes, { alias: true, dataview: false });
        expect(noDV).toHaveLength(1);
        expect(noDV[0].syntax).toBe(LinkSyntax.SemanticAlias);
    });

    // ==========================================
    // Новые тесты — покрытие edge cases
    // ==========================================

    describe('Edge cases', () => {
        test('should return empty array when trustedTypes is empty (L18 branch)', () => {
            // Покрываем ранний return на строке 18
            const text = '[[Target|supports]] and supports:: [[B]]';
            const links = ParserLogic.parseText(text, sourcePath, [], defaultOptions);
            expect(links).toHaveLength(0);
        });

        test('should return empty array for empty text', () => {
            const links = ParserLogic.parseText('', sourcePath, trustedTypes, defaultOptions);
            expect(links).toHaveLength(0);
        });

        test('should correctly set sourcePath on parsed links', () => {
            const text = '[[Target|supports]]';
            const links = ParserLogic.parseText(text, 'Projects/Note.md', trustedTypes, defaultOptions);
            expect(links[0].sourcePath).toBe('Projects/Note.md');
        });

        test('should not match non-trusted types', () => {
            const text = '[[Note|random_type]] and unknown:: [[B]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links).toHaveLength(0);
        });

        test('should handle inline code masking correctly', () => {
            const text = 'Before `supports:: [[Masked]]` After [[Real|supports]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links).toHaveLength(1);
            expect(links[0].targetPath).toBe('Real');
        });

        test('should correctly extract rawValue for alias syntax', () => {
            const text = '[[Target|supports]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links[0].rawValue).toBe('[[Target|supports]]');
        });

        test('should correctly extract targetPath for dataview syntax', () => {
            const text = 'supports:: [[Some/Nested/Note]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links[0].targetPath).toBe('Some/Nested/Note');
        });

        test('should handle multiple dataview links on separate lines', () => {
            const text = 'supports:: [[A]]\ncontradicts:: [[B]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links).toHaveLength(2);
            expect(links.map(l => l.type)).toContain('supports');
            expect(links.map(l => l.type)).toContain('contradicts');
        });

        test('should not parse links with newlines in path', () => {
            // Защита от multi-line injection
            const text = '[[Target\nBad|supports]]';
            const links = ParserLogic.parseText(text, sourcePath, trustedTypes, defaultOptions);
            expect(links).toHaveLength(0);
        });
    });

    describe('Regex cache invalidation (M1)', () => {
        test('should work with different trustedTypes sets without caching issues', () => {
            const text = '[[A|alpha]] and [[B|beta]]';

            const linksAlpha = ParserLogic.parseText(text, sourcePath, ['alpha'], defaultOptions);
            expect(linksAlpha).toHaveLength(1);
            expect(linksAlpha[0].type).toBe('alpha');

            // При смене trustedTypes кеш должен инвалидироваться
            const linksBeta = ParserLogic.parseText(text, sourcePath, ['beta'], defaultOptions);
            expect(linksBeta).toHaveLength(1);
            expect(linksBeta[0].type).toBe('beta');

            // Возврат к original набору
            const linksBoth = ParserLogic.parseText(text, sourcePath, ['alpha', 'beta'], defaultOptions);
            expect(linksBoth).toHaveLength(2);
        });

        test('should handle regex special characters in type names', () => {
            // Тип с символами, которые могут сломать regex без escaping
            const text = '[[Target|c++]]';
            const links = ParserLogic.parseText(text, sourcePath, ['c++'], defaultOptions);
            expect(links).toHaveLength(1);
            expect(links[0].type).toBe('c++');
        });
    });
});
