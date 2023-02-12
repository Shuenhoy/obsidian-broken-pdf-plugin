import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

declare class BetterPDFPlugin extends Plugin {
    settings: BetterPdfSettings;
}

export class BetterPdfSettings {
    fit_by_default: boolean = true;
    link_by_default: boolean = true;
    render_dpi: number = 72;
    cocurrency: number = 4;
    max_cached_opened_files: number = 10;
    max_cached_rendered_pieces: number = 50;
    zotero_storage: string = "";
}

export class BetterPdfSettingsTab extends PluginSettingTab {
    plugin: BetterPDFPlugin;

    constructor(app: App, plugin: BetterPDFPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Fit pages by default")
            .setDesc("When turned on, pages will be scaled to the view by default. Can be overridden using the 'fit' parameter")
            .addToggle(toggle => toggle.setValue(this.plugin.settings.fit_by_default)
                .onChange((value) => {
                    this.plugin.settings.fit_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName("Link pages by default")
            .setDesc("When turned on, pages will be linked to their document by default. Can be overridden using the 'link' parameter")
            .addToggle(toggle => toggle.setValue(this.plugin.settings.link_by_default)
                .onChange((value) => {
                    this.plugin.settings.link_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName("PDF render DPI")
            .setDesc("Default: 72")
            .addText(text => text.setValue(`${this.plugin.settings.render_dpi}`).onChange((value) => {
                this.plugin.settings.render_dpi = Number.parseInt(value);
                this.plugin.saveData(this.plugin.settings);
            }));

        new Setting(containerEl)
            .setName("Cocurrency for rendering")
            .setDesc("Default: 4")
            .addText(text => text.setValue(`${this.plugin.settings.cocurrency}`).onChange((value) => {
                this.plugin.settings.cocurrency = Number.parseInt(value);
                this.plugin.saveData(this.plugin.settings);
            }));

        new Setting(containerEl)
            .setName("Max cached opened files")
            .setDesc("Default: 10. You need to reload this plugin to apply this setting.")
            .addText(text => text.setValue(`${this.plugin.settings.max_cached_opened_files}`).onChange((value) => {
                this.plugin.settings.max_cached_opened_files = Number.parseInt(value);
                this.plugin.saveData(this.plugin.settings);
            }));

        new Setting(containerEl)
            .setName("Max cached rendered pieces")
            .setDesc("Default: 50. You need to reload this plugin to apply this setting.")
            .addText(text => text.setValue(`${this.plugin.settings.max_cached_rendered_pieces}`).onChange((value) => {
                this.plugin.settings.max_cached_rendered_pieces = Number.parseInt(value);
                this.plugin.saveData(this.plugin.settings);
            }));

        new Setting(containerEl)
            .setName("Path of Zotero Storage")
            .setDesc("Path of Zotero Storage")
            .addText(text => text.setValue(`${this.plugin.settings.zotero_storage}`).onChange((value) => {
                this.plugin.settings.zotero_storage = value;
                this.plugin.saveData(this.plugin.settings);
            }))
    }
}