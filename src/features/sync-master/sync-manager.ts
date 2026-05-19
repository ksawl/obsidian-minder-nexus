import { TFile } from 'obsidian';
import NexusPlugin from '../../main';
import { ParserLogic } from '../semantic-engine/logic';
import { INexusLink, LinkSyntax } from '../../core/types';

export class SyncManager {
	plugin: NexusPlugin;
	private syncingFiles = new Set<string>();
	// H3 FIX: Храним ID таймеров для очистки при выгрузке
	private pendingTimeouts: number[] = [];

	constructor(plugin: NexusPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Инициализация слушателей событий
	 */
	init() {
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on('changed', (file) => {
				if (!this.plugin.settings.enableModules.sync) return;
				if (this.syncingFiles.has(file.path)) return;
				void this.handleFileChange(file);
			})
		);
	}

	/**
	 * Очистка ресурсов при выгрузке плагина
	 */
	destroy() {
		// H3 FIX: Очищаем все pending timeouts
		for (const id of this.pendingTimeouts) {
			activeWindow.clearTimeout(id);
		}
		this.pendingTimeouts = [];
		this.syncingFiles.clear();
	}

	/**
	 * Обработка изменения файла
	 */
	private async handleFileChange(file: TFile) {
		if (this.plugin.settings.sync.mode === 'off') return;

		// C3 FIX: try/catch на vault.read — файл может быть удалён между событием и чтением
		let content: string;
		try {
			content = await this.plugin.app.vault.read(file);
		} catch {
			// Файл был удалён или переименован — просто пропускаем
			return;
		}

		const trustedTypes = this.plugin.settings.semantic.trustedTypes;
		
		const links = ParserLogic.parseText(
			content, 
			file.path, 
			trustedTypes, 
			this.plugin.settings.semantic.syntaxOptions
		);

		// H2 FIX: Группируем ссылки по targetPath, чтобы один вызов processFrontMatter на файл
		const groupedByTarget = new Map<string, INexusLink[]>();
		for (const link of links) {
			const key = link.targetPath;
			if (!groupedByTarget.has(key)) {
				groupedByTarget.set(key, []);
			}
			groupedByTarget.get(key)!.push(link);
		}

		for (const [targetPath, targetLinks] of groupedByTarget) {
			await this.syncGroupToTarget(targetPath, targetLinks);
		}
	}

	/**
	 * H2 FIX: Запись ВСЕХ обратных связей для одного целевого файла за один processFrontMatter
	 */
	private async syncGroupToTarget(targetPath: string, links: INexusLink[]) {
		if (links.length === 0) return;
		const firstLink = links[0];

		const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(targetPath, firstLink.sourcePath);
		if (!targetFile || !(targetFile instanceof TFile)) return;

		const propertyKey = this.plugin.settings.sync.targetProperty;
		const sourceFile = this.plugin.app.vault.getAbstractFileByPath(firstLink.sourcePath);
		
		if (!sourceFile || !(sourceFile instanceof TFile)) return;
		if (this.syncingFiles.has(targetFile.path)) return;

		const sourceLinkText = this.plugin.app.metadataCache.fileToLinktext(sourceFile, targetFile.path);

		try {
			this.syncingFiles.add(targetFile.path);
			await this.plugin.app.fileManager.processFrontMatter(targetFile, (frontmatter: Record<string, unknown>) => {
				let relations = frontmatter[propertyKey];
				if (!Array.isArray(relations)) {
					relations = typeof relations === 'string' ? [relations] : [];
				}
				const relationsArray = relations as string[];

				for (const link of links) {
					const relationEntry = `[[${sourceLinkText}]] (${link.type})`;

					const alreadyExists = relationsArray.some((rel: string) => 
						typeof rel === 'string' && 
						rel.includes(`[[${sourceLinkText}]]`) && rel.includes(`(${link.type})`)
					);

					if (!alreadyExists) {
						relationsArray.push(relationEntry);
					}
				}

				frontmatter[propertyKey] = relationsArray;
			});
		} catch (e) {
			console.error(`Nexus: Failed to sync to ${targetFile.path}`, e);
		} finally {
			// H3 FIX: Регистрируем timeout для очистки при выгрузке
			const timeoutId = activeWindow.setTimeout(() => {
				this.syncingFiles.delete(targetFile.path);
				// Удаляем ID из массива после выполнения
				const idx = this.pendingTimeouts.indexOf(timeoutId);
				if (idx !== -1) this.pendingTimeouts.splice(idx, 1);
			}, 500);
			this.pendingTimeouts.push(timeoutId);
		}
	}

	/**
	 * Публичный метод для ручной синхронизации (используется в UI)
	 */
	async syncManual(targetPath: string, sourcePath: string, type: string) {
		const links: INexusLink[] = [{
			sourcePath,
			targetPath,
			type,
			syntax: LinkSyntax.SemanticAlias,
			position: { start: 0, end: 0 },
			rawValue: ''
		}];
		await this.syncGroupToTarget(targetPath, links);
	}
}
