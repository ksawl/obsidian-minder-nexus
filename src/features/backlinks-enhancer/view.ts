import { 
    ItemView, 
    WorkspaceLeaf, 
    TFile
} from 'obsidian';
import NexusPlugin from '../../main';
import { ParserLogic } from '../semantic-engine/logic';

export const VIEW_TYPE_NEXUS_BACKLINKS = 'nexus-backlinks-view';

interface MetadataCacheWithBacklinks {
    getBacklinksForFile(file: TFile): { data: Record<string, unknown> };
}

export class BacklinksView extends ItemView {
    plugin: NexusPlugin;
    private currentFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: NexusPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_NEXUS_BACKLINKS;
    }

    getDisplayText(): string {
        return 'Backlinks';
    }

    getIcon(): string {
        return 'link-2';
    }

    onOpen(): Promise<void> {
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => this.update())
        );
        this.update();
        return Promise.resolve();
    }

    update() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile === this.currentFile) {
            if (!activeFile) this.renderEmpty();
            return;
        }

        this.currentFile = activeFile;
        void this.renderBacklinks();
    }

    private renderEmpty() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createDiv({ 
            text: 'No active file selected.', 
            cls: 'nexus-backlinks-empty' 
        });
    }

    private async renderBacklinks() {
        if (!this.currentFile) return;

        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nexus-backlinks-container');

        contentEl.createEl('h3', { text: `Backlinks for: ${this.currentFile.basename}` });

        // Достаем все бэклинк из кэша
        const backlinksMap = (this.app.metadataCache as unknown as MetadataCacheWithBacklinks).getBacklinksForFile(this.currentFile);
        const sourcePaths = Object.keys(backlinksMap.data || {});

        if (sourcePaths.length === 0) {
            contentEl.createDiv({ text: 'No backlinks found.', cls: 'nexus-backlinks-empty' });
            return;
        }

        // Группируем по типу
        const grouped: Record<string, { file: TFile, type: string, raw: string }[]> = {
            'UNCLASSIFIED': []
        };

        for (const sourcePath of sourcePaths) {
            const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
            if (!(sourceFile instanceof TFile)) continue;

            const content = await this.app.vault.read(sourceFile);
            const semanticLinks = ParserLogic.parseText(
                content, 
                sourcePath, 
                this.plugin.settings.semantic.trustedTypes,
                this.plugin.settings.semantic.syntaxOptions
            );

            // Ищем ссылки, ведущие на текущий файл
            const relevantLinks = semanticLinks.filter(l => {
                const dest = this.app.metadataCache.getFirstLinkpathDest(l.targetPath, sourcePath);
                return dest?.path === this.currentFile?.path;
            });

            if (relevantLinks.length > 0) {
                relevantLinks.forEach(link => {
                    const type = link.type.toUpperCase();
                    if (!grouped[type]) grouped[type] = [];
                    grouped[type].push({ file: sourceFile, type: link.type, raw: link.rawValue });
                });
            } else {
                grouped['UNCLASSIFIED'].push({ file: sourceFile, type: 'link', raw: '[[' + this.currentFile.basename + ']]' });
            }
        }

        // Рендерим группы
        for (const [groupName, items] of Object.entries(grouped)) {
            if (items.length === 0) continue;

            const section = contentEl.createDiv({ cls: 'nexus-backlinks-section' });
            section.createEl('h4', { text: groupName, cls: 'nexus-backlinks-header' });

            items.forEach(item => {
                const row = section.createDiv({ cls: 'nexus-backlinks-row' });
                
                const linkInfo = row.createDiv({ cls: 'nexus-backlinks-info' });
                linkInfo.createSpan({ text: item.file.basename, cls: 'nexus-backlinks-filename' }).onclick = () => {
                    void this.app.workspace.getLeaf(false).openFile(item.file);
                };
                linkInfo.createDiv({ text: item.raw, cls: 'nexus-backlinks-snippet' });

                // Кнопка для быстрой синхронизации (если еще не синхронизировано)
                const actionBtn = row.createEl('button', { 
                    text: 'Sync', 
                    cls: 'nexus-backlinks-action-btn' 
                });
                actionBtn.onclick = () => {
                    void this.plugin.syncManager.syncManual(
                        this.currentFile!.path,
                        item.file.path,
                        item.type
                    );
                };
            });
        }
    }
}
