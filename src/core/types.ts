/**
 * Типы поддерживаемого синтаксиса для семантических связей
 */
export enum LinkSyntax {
    SemanticAlias = 'SemanticAlias', // [[Note|type]]
    DataviewInline = 'DataviewInline', // type:: [[Note]]
}

/**
 * Основной интерфейс семантической связи
 */
export interface INexusLink {
    sourcePath: string;    // Путь к файлу-источнику
    targetPath: string;    // Путь к целевому файлу
    type: string;          // Тип связи (напр. "опровергает")
    syntax: LinkSyntax;    // Какой синтаксис использован
    position: {            // Положение в тексте для декораций
        start: number;
        end: number;
    };
    rawValue: string;      // Исходная строка из текста
}

/**
 * Настройки плагина
 */
export interface INexusSettings {
    enableModules: {
        semantic: boolean;
        sync: boolean;
        deadLinks: boolean;
    };
    semantic: {
        trustedTypes: string[];
        syntaxOptions: {
            alias: boolean;
            dataview: boolean;
        };
    };
    sync: {
        mode: 'properties' | 'off';
        targetProperty: string;
    };
}

export const DEFAULT_SETTINGS: INexusSettings = {
    enableModules: {
        semantic: true,
        sync: true,
        deadLinks: true
    },
    semantic: {
        trustedTypes: ['supports', 'contradicts', 'cites', 'is_a', 'part_of'],
        syntaxOptions: {
            alias: true,
            dataview: true
        }
    },
    sync: {
        mode: 'properties',
        targetProperty: 'nexus-relations'
    }
};
