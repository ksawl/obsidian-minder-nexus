import { App, Modal, TFile, Setting } from 'obsidian';

export interface DeadLinkInfo {
    file: TFile;
    deadLink: {
        targetPath: string;
        type: string;
    };
}

export class DeadLinkModal extends Modal {
    results: DeadLinkInfo[];

    constructor(app: App, results: DeadLinkInfo[]) {
        super(app);
        this.results = results;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Dead semantic links report' });
        contentEl.createEl('p', { 
            text: `Found ${this.results.length} dead semantic links. Click on a file name to open it.`,
            cls: 'nexus-modal-description'
        });

        const listEl = contentEl.createDiv({ cls: 'nexus-dead-links-list' });

        // Группируем по файлам для удобства
        const groupedByFile = new Map<string, DeadLinkInfo[]>();
        for (const res of this.results) {
            const path = res.file.path;
            if (!groupedByFile.has(path)) {
                groupedByFile.set(path, []);
            }
            groupedByFile.get(path)?.push(res);
        }

        groupedByFile.forEach((links, filePath) => {
            const fileContainer = listEl.createDiv({ cls: 'nexus-dead-link-file-group' });
            
            new Setting(fileContainer)
                .setName(filePath)
                .setDesc(`${links.length} dead link(s)`)
                .addButton(btn => {
                    btn.setButtonText('Open file')
                        .onClick(() => {
                            const file = this.app.vault.getAbstractFileByPath(filePath);
                            if (file instanceof TFile) {
                                void this.app.workspace.getLeaf().openFile(file);
                                this.close();
                            }
                        });
                });

            const ul = fileContainer.createEl('ul');
            links.forEach(l => {
                const li = ul.createEl('li');
                li.createSpan({ text: `Type: `, cls: 'nexus-modal-label' });
                li.createSpan({ text: l.deadLink.type, cls: 'nexus-modal-value-type' });
                li.createSpan({ text: ` | Target: `, cls: 'nexus-modal-label' });
                li.createSpan({ text: l.deadLink.targetPath, cls: 'nexus-modal-value-path' });
            });
        });

        if (this.results.length > 0) {
            new Setting(contentEl)
                .addButton(btn => {
                    btn.setButtonText('Close')
                        .onClick(() => this.close());
                });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
