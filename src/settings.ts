import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

declare class BetterPDFPlugin extends Plugin {
    settings: BetterPdfSettings;
}

export class BetterPdfSettings {
    fit_by_default: boolean = true;
    link_by_default: boolean = true;
    render_dpi: number = 72;
    cocurrency: number = 2;
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
            .setName("Cocurrency")
            .setDesc("Default: 2")
            .addText(text => text.setValue(`${this.plugin.settings.cocurrency}`).onChange((value) => {
                this.plugin.settings.cocurrency = Number.parseInt(value);
                this.plugin.saveData(this.plugin.settings);
            }));
    }
}