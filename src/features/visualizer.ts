import { MarkdownPostProcessorContext } from 'obsidian';
import NexusPlugin from '../main';

export class VisualizerModule {
	plugin: NexusPlugin;

	constructor(plugin: NexusPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Обработчик режима чтения (Markdown Post Processor)
	 */
	registerReadingMode() {
		this.plugin.registerMarkdownPostProcessor((element, context) => {
			this.processElement(element, context);
		});
	}

	private processElement(element: HTMLElement, context: MarkdownPostProcessorContext) {
		// КРИТИЧЕСКИЙ ФИКС: Проверяем, включен ли модуль
		if (!this.plugin.settings.enableModules.semantic) return;

		const links = element.querySelectorAll('a.internal-link');
		
		links.forEach((linkEl: Element) => {
			const anchor = linkEl as HTMLAnchorElement;
			// M5 FIX: textContent вместо innerText — без layout reflow
			const text = (anchor.textContent || '').trim();
			const targetPath = anchor.getAttribute('data-href') || '';
			const trustedTypes = this.plugin.settings.semantic.trustedTypes;

			// M2 FIX: Case-insensitive matching для устойчивости к регистру
			const textLower = text.toLowerCase();
			const isSemanticType = trustedTypes.some(t => t.toLowerCase() === textLower);
			if (isSemanticType && textLower !== targetPath.toLowerCase()) {
				// Проверяем существование файла
				const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(targetPath, context.sourcePath);
				const isDead = !targetFile;

				this.enhanceLink(anchor, text, targetPath, isDead);
			}
		});
	}

	private enhanceLink(linkEl: HTMLAnchorElement, type: string, targetPath: string, isDead: boolean = false) {
		// Извлекаем только имя файла без расширения
		// L3 FIX: Удаляем .md только в конце строки
		const targetName = targetPath.split('/').pop()?.replace(/\.md$/, '') || targetPath;
		
		linkEl.addClass('nexus-semantic-link');
		if (isDead) linkEl.addClass('nexus-link-dead');
		
		linkEl.setAttribute('data-nexus-type', type);
		// Устанавливаем текст как имя заметки, тип будет добавлен через CSS ::after
		linkEl.innerText = targetName;
	}
}
