import { TFile, Notice } from 'obsidian';
import NexusPlugin from '../main';
import { ParserLogic } from './semantic-engine/logic';

export class DeadLinkWatcher {
	plugin: NexusPlugin;

	constructor(plugin: NexusPlugin) {
		this.plugin = plugin;
	}

	/**
	 * H4 FIX: Оптимизированное сканирование с cachedRead и батчевой обработкой
	 */
	async scanAll(): Promise<{ file: TFile, deadLink: { targetPath: string, type: string } }[]> {
		const deadLinks: { file: TFile, deadLink: { targetPath: string, type: string } }[] = [];
		const files = this.plugin.app.vault.getMarkdownFiles();
		const trustedTypes = this.plugin.settings.semantic.trustedTypes;
		const options = this.plugin.settings.semantic.syntaxOptions;
		
		// H4 FIX: Батчевая обработка — 50 файлов параллельно
		const BATCH_SIZE = 50;
		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);
			const results = await Promise.all(
				batch.map(file => this.scanFile(file, trustedTypes, options))
			);
			for (const fileDeadLinks of results) {
				deadLinks.push(...fileDeadLinks);
			}
		}

		return deadLinks;
	}

	/**
	 * Сканирование одного файла
	 */
	private async scanFile(
		file: TFile, 
		trustedTypes: string[], 
		options: { alias: boolean, dataview: boolean }
	): Promise<{ file: TFile, deadLink: { targetPath: string, type: string } }[]> {
		const deadLinks: { file: TFile, deadLink: { targetPath: string, type: string } }[] = [];

		try {
			// H4 FIX: cachedRead вместо read — без обращения к диску
			const content = await this.plugin.app.vault.cachedRead(file);
			const links = ParserLogic.parseText(content, file.path, trustedTypes, options);

			for (const link of links) {
				const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(link.targetPath, file.path);
				if (!targetFile) {
					deadLinks.push({ 
						file, 
						deadLink: { 
							targetPath: link.targetPath, 
							type: link.type 
						} 
					});
				}
			}
		} catch (e) {
			// Файл может быть удалён во время сканирования — пропускаем
			console.warn(`Nexus: Could not read ${file.path}`, e);
		}

		return deadLinks;
	}

	/**
	 * Регистрация команды для ручного запуска
	 */
	registerCommands() {
		this.plugin.addCommand({
			id: 'scan-dead-links',
			name: 'Scan vault for dead semantic links',
			callback: async () => {
				if (!this.plugin.settings.enableModules.deadLinks) {
					new Notice('Dead link watcher module is disabled.');
					return;
				}
				
				new Notice('Scanning for dead semantic links...');
				const results = await this.scanAll();
				
				if (results.length === 0) {
					new Notice('No dead semantic links found. Your graph is healthy.');
				} else {
					// L7 FIX: try/catch на dynamic import
					try {
						const { DeadLinkModal } = await import('../ui/DeadLinkModal');
						new DeadLinkModal(this.plugin.app, results).open();
					} catch (e) {
						console.error('Nexus: Failed to open Dead Link Modal', e);
					}
					new Notice(`Found ${results.length} dead semantic links.`);
				}
			}
		});
	}
}
