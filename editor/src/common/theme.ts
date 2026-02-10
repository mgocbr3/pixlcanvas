type ThemeName = 'classic' | 'dark' | 'gray';

type ThemeConfig = {
    label: string;
    editorCss: string;
    codeEditorCss: string;
    monacoTheme: string;
};

const THEME_STORAGE_KEY = 'editor:theme';
const DEFAULT_THEME: ThemeName = 'classic';

const THEME_CONFIG: Record<ThemeName, ThemeConfig> = {
    classic: {
        label: 'Classic (Blue)',
        editorCss: '/css/editor.css',
        codeEditorCss: '/css/code-editor.css',
        monacoTheme: 'playcanvas'
    },
    dark: {
        label: 'Dark (Black)',
        editorCss: '/css/editor-dark.css',
        codeEditorCss: '/css/code-editor-dark.css',
        monacoTheme: 'vs-dark'
    },
    gray: {
        label: 'Dark Gray (Neutral)',
        editorCss: '/css/editor-neutral.css',
        codeEditorCss: '/css/code-editor-neutral.css',
        monacoTheme: 'vs-dark'
    }
};

const isValidTheme = (value: unknown): value is ThemeName => {
    return value === 'classic' || value === 'dark' || value === 'gray';
};

const readThemeStorage = () => {
    if (typeof editor !== 'undefined' && editor.call) {
        try {
            return editor.call('localStorage:get', THEME_STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

const writeThemeStorage = (theme: ThemeName) => {
    if (typeof editor !== 'undefined' && editor.call) {
        try {
            editor.call('localStorage:set', THEME_STORAGE_KEY, theme);
            return;
        } catch (error) {
            // fall back to window.localStorage
        }
    }

    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        // ignore storage failures
    }
};

const getThemeFromStorage = (): ThemeName => {
    const stored = readThemeStorage();
    return isValidTheme(stored) ? stored : DEFAULT_THEME;
};

const updateStylesheet = (pattern: string, href: string) => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const matched = links.filter((link) => link.getAttribute('href')?.includes(pattern));

    if (matched.length === 0) {
        return;
    }

    matched.forEach((link) => {
        if (link.getAttribute('href') !== href) {
            link.setAttribute('href', href);
        }
    });
};

const applyTheme = (theme: ThemeName, persist: boolean) => {
    const normalized = isValidTheme(theme) ? theme : DEFAULT_THEME;
    const config = THEME_CONFIG[normalized];

    document.documentElement.dataset.theme = normalized;

    updateStylesheet('/css/editor', config.editorCss);
    updateStylesheet('/css/code-editor', config.codeEditorCss);

    if (persist) {
        writeThemeStorage(normalized);
    }

    if (typeof editor !== 'undefined' && editor.isCodeEditor) {
        const settings = editor.call?.('editor:settings');
        if (settings && settings.get('ide.theme') !== config.monacoTheme) {
            settings.set('ide.theme', config.monacoTheme);
        }
    }

    if (typeof editor !== 'undefined') {
        editor.emit('theme:change', normalized);
    }

    return normalized;
};

const applyStoredTheme = () => {
    applyTheme(getThemeFromStorage(), false);
};

applyStoredTheme();

if (typeof editor !== 'undefined') {
    editor.once('load', () => {
        applyStoredTheme();

        editor.method('theme:get', () => {
            return getThemeFromStorage();
        });

        editor.method('theme:list', () => {
            return Object.entries(THEME_CONFIG).map(([value, config]) => ({
                value,
                label: config.label
            }));
        });

        editor.method('theme:set', (value: ThemeName) => {
            return applyTheme(value, true);
        });

        window.addEventListener('storage', (event) => {
            if (event.key === THEME_STORAGE_KEY) {
                applyStoredTheme();
            }
        });
    });
}

export { THEME_STORAGE_KEY, THEME_CONFIG };
