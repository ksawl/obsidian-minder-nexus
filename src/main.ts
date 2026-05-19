import { Plugin, MarkdownView, debounce } from 'obsidian';
import { DEFAULT_SETTINGS, INexusSettings } from './core/types';
import { NexusSettingsTab } from './ui/NexusSettingsTab';
import { SemanticSuggest } from './ui/SemanticSuggest';
import { DataviewSuggest } from './ui/DataviewSuggest';
import { TypePickerModal } from './ui/TypePickerModal';
import { VisualizerModule } from './features/visualizer';
import { livePreviewExtension } from './features/live-preview';
import { SyncManager } from './features/sync-master/sync-manager';
import { DeadLinkWatcher } from './features/dead-link-watcher';
import { BacklinksEnhancerModule } from './features/backlinks-enhancer';

export default class NexusPlugin extends Plugin {
	settings: INexusSettings = DEFAULT_SETTINGS;
	// L2 FIX: Используем definite assignment через явную инициализацию заглушками.
	// Реальные экземпляры создаются в onload() до любого использования.
	visualizer = null as unknown as VisualizerModule;
	syncManager = null as unknown as SyncManager;
	deadLinkWatcher = null as unknown as DeadLinkWatcher;
	backlinksEnhancer = null as unknown as BacklinksEnhancerModule;

	// C1 FIX: Debounced refresh предотвращает UI flood при массовых операциях
	private debouncedRefresh = debounce(() => this.refresh(), 300, false);

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new NexusSettingsTab(this.app, this));
		this.registerEditorSuggest(new SemanticSuggest(this.app, this));
		this.registerEditorSuggest(new DataviewSuggest(this.app, this));

		// Hotkey: вставка семантического типа через модальное окно
		this.addCommand({
			id: 'insert-semantic-type',
			name: 'Insert semantic relation type',
			editorCallback: (editor) => {
				new TypePickerModal(this.app, this, editor).open();
			}
		});

		this.visualizer = new VisualizerModule(this);
		this.visualizer.registerReadingMode();

		this.syncManager = new SyncManager(this);
		this.syncManager.init();

		this.deadLinkWatcher = new DeadLinkWatcher(this);
		this.deadLinkWatcher.registerCommands();

		this.backlinksEnhancer = new BacklinksEnhancerModule(this);
		this.backlinksEnhancer.init();

		this.registerEditorExtension(livePreviewExtension(this));

		// Реактивность: обновляем визуализацию при изменении файловой структуры
		// C1 FIX: debounce(300ms) — при импорте 100 файлов refresh вызовется 1 раз, не 100
		this.registerEvent(
			this.app.vault.on('create', () => this.debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.debouncedRefresh())
		);

	}

	onunload() {
		// H3 FIX: Чистим ресурсы SyncManager (pending timeouts)
		this.syncManager.destroy();
	}

	async loadSettings() {
		const saved = (await this.loadData() as Partial<INexusSettings>) || {};
		this.settings = {
			...DEFAULT_SETTINGS,
			...saved,
			enableModules: { 
				...DEFAULT_SETTINGS.enableModules, 
				...(saved.enableModules || {}) 
			},
			semantic: {
				...DEFAULT_SETTINGS.semantic,
				...(saved.semantic || {}),
				trustedTypes: Array.isArray(saved.semantic?.trustedTypes) 
					? saved.semantic.trustedTypes 
					: DEFAULT_SETTINGS.semantic.trustedTypes,
				syntaxOptions: {
					...DEFAULT_SETTINGS.semantic.syntaxOptions,
					...(saved.semantic?.syntaxOptions || {})
				}
			},
			sync: { 
				...DEFAULT_SETTINGS.sync, 
				...(saved.sync || {}) 
			}
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Мы вызываем refresh явно там, где меняются визуальные настройки
	}

	/**
	 * Принудительное обновление всех визуальных элементов
	 */
	refresh() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode?.rerender(true);
			}
		});
		
		this.app.workspace.trigger('nexus:refresh');
	}
}
