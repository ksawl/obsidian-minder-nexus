import { App, PluginSettingTab, Setting, debounce } from 'obsidian';
import NexusPlugin from '../main';
import { INexusSettings } from '../core/types';

export class NexusSettingsTab extends PluginSettingTab {
	plugin: NexusPlugin;

	constructor(app: App, plugin: NexusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Core modules').setHeading();

		new Setting(containerEl)
			.setName('Semantic engine')
			.setDesc('Enable/disable link visualization and parsing.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableModules.semantic)
				.onChange(async (value) => {
					this.plugin.settings.enableModules.semantic = value;
					await this.plugin.saveSettings();
					this.plugin.refresh();
				}));

		new Setting(containerEl)
			.setName('Sync master')
			.setDesc('Enable/disable bidirectional link synchronization.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableModules.sync)
				.onChange(async (value) => {
					this.plugin.settings.enableModules.sync = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Dead link watcher')
			.setDesc('Enable/disable scanning for broken semantic links.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableModules.deadLinks)
				.onChange(async (value) => {
					this.plugin.settings.enableModules.deadLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Semantic engine').setHeading();

		// ФИКС P18/P19: Используем Obsidian debounce и immediate = false
		const saveDebounced = debounce(async () => {
			await this.plugin.saveSettings();
			this.plugin.refresh();
		}, 500, false);

		new Setting(containerEl)
			.setName('Trusted link types')
			.setDesc('List of link types that the plugin will treat as semantic.')
			.then(_setting => {
				const cloudEl = containerEl.createDiv({ cls: 'nexus-tag-cloud' });
				
				const renderPills = () => {
					cloudEl.empty();
					this.plugin.settings.semantic.trustedTypes.forEach(type => {
						const pill = cloudEl.createDiv({ cls: 'nexus-tag-pill', text: type });
						const removeBtn = pill.createSpan({ cls: 'nexus-tag-pill-remove', text: '×' });
						removeBtn.onclick = async () => {
							this.plugin.settings.semantic.trustedTypes = 
								this.plugin.settings.semantic.trustedTypes.filter(t => t !== type);
							await this.plugin.saveSettings();
							this.plugin.refresh();
							renderPills();
						};
					});
				};

				renderPills();

				const inputContainer = containerEl.createDiv({ cls: 'nexus-tag-input-container' });
				const inputEl = inputContainer.createEl('input', { 
					cls: 'nexus-tag-input',
					attr: { type: 'text', placeholder: 'Add new type (e.g. Supports)' }
				});
				
				const addBtn = inputContainer.createEl('button', {
					cls: 'nexus-tag-add-btn',
					text: 'Add'
				});

				const handleAdd = async () => {
					const val = inputEl.value.trim();
					if (val && !this.plugin.settings.semantic.trustedTypes.includes(val)) {
						this.plugin.settings.semantic.trustedTypes.push(val);
						await this.plugin.saveSettings();
						this.plugin.refresh();
						inputEl.value = '';
						renderPills();
					}
				};

				addBtn.onclick = handleAdd;
				inputEl.onkeydown = (e) => {
					if (e.key === 'Enter') void handleAdd();
				};
			});

		new Setting(containerEl)
			.setName('Semantic aliases')
			.setDesc('Enable support for [[note|type]] syntax.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.semantic.syntaxOptions.alias)
				.onChange(async (value) => {
					this.plugin.settings.semantic.syntaxOptions.alias = value;
					await this.plugin.saveSettings();
					this.plugin.refresh();
				}));

		new Setting(containerEl)
			.setName('Dataview inline fields')
			.setDesc('Enable support for type:: [[note]] syntax.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.semantic.syntaxOptions.dataview)
				.onChange(async (value) => {
					this.plugin.settings.semantic.syntaxOptions.dataview = value;
					await this.plugin.saveSettings();
					this.plugin.refresh();
				}));

		new Setting(containerEl).setName('Synchronization (sync master)').setHeading();

		new Setting(containerEl)
			.setName('Sync mode')
			.setDesc('Where to write reciprocal bidirectional links.')
			.addDropdown(dropdown => dropdown
				.addOption('properties', 'YAML properties')
				.addOption('off', 'Disabled')
				.setValue(this.plugin.settings.sync.mode)
				.onChange(async (value) => {
					this.plugin.settings.sync.mode = value as INexusSettings['sync']['mode'];
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target property')
			.setDesc('YAML property name for storing links.')
			.addText(text => text
				.setPlaceholder('Nexus-relations')
				.setValue(this.plugin.settings.sync.targetProperty)
				.onChange((value) => {
					this.plugin.settings.sync.targetProperty = value;
					saveDebounced();
				}));
	}
}
