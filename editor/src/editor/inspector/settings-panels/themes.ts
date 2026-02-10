import { LabelGroup, SelectInput } from '@playcanvas/pcui';

import { BaseSettingsPanel } from './base';

type ThemeOption = {
    value: string;
    label: string;
};

const DEFAULT_OPTIONS: ThemeOption[] = [
    { value: 'classic', label: 'Classic (Blue)' },
    { value: 'dark', label: 'Dark (Black)' },
    { value: 'gray', label: 'Dark Gray (Neutral)' }
];

class ThemesSettingsPanel extends BaseSettingsPanel {
    constructor(args) {
        args = Object.assign({}, args);
        args.headerText = 'THEMES';
        args.userOnlySettings = true;

        super(args);

        const themeOptions: ThemeOption[] = editor.call('theme:list') || DEFAULT_OPTIONS;

        const fieldTheme = new SelectInput({
            options: themeOptions.map(option => ({
                v: option.value,
                t: option.label
            })),
            type: 'string'
        });

        const labelGroup = new LabelGroup({
            text: 'Editor Theme',
            field: fieldTheme
        });

        this.append(labelGroup);

        let suspendChange = false;
        const applyThemeValue = (value) => {
            suspendChange = true;
            fieldTheme.value = value;
            suspendChange = false;
        };

        applyThemeValue(editor.call('theme:get') || 'classic');

        fieldTheme.on('change', (value) => {
            if (suspendChange) {
                return;
            }
            editor.call('theme:set', value);
        });

        const themeChangeEvent = editor.on('theme:change', (value) => {
            applyThemeValue(value);
        });

        this.once('destroy', () => {
            themeChangeEvent.unbind();
        });
    }
}

export { ThemesSettingsPanel };
