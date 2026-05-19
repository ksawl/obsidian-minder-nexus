import { WorkspaceLeaf } from 'obsidian';
import NexusPlugin from '../../main';
import { BacklinksView, VIEW_TYPE_NEXUS_BACKLINKS } from './view';

export class BacklinksEnhancerModule {
    plugin: NexusPlugin;

    constructor(plugin: NexusPlugin) {
        this.plugin = plugin;
    }

    init() {
        this.plugin.registerView(
            VIEW_TYPE_NEXUS_BACKLINKS,
            (leaf) => new BacklinksView(leaf, this.plugin)
        );

        this.plugin.addCommand({
            id: 'open-backlinks',
            name: 'Open backlinks',
            callback: () => this.activateView()
        });

        this.plugin.addRibbonIcon('link-2', 'Backlinks', () => {
            void this.activateView();
        });
    }

    async activateView() {
        const { workspace } = this.plugin.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_NEXUS_BACKLINKS);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_NEXUS_BACKLINKS,
                    active: true,
                });
            }
        }

        if (leaf) {
            void workspace.revealLeaf(leaf);
        }
    }
}
