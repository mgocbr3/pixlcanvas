import { createRoot } from 'react-dom/client';

import { MainLayout } from './components/MainLayout.mjs';
import { jsx } from './jsx.mjs';


import '@playcanvas/pcui/styles';

const THEME_STORAGE_KEY = 'editor:theme';

const applyExamplesTheme = () => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const theme = storedTheme === 'gray' ? 'gray' : storedTheme === 'dark' ? 'dark' : 'classic';
    const stylesheet = document.querySelector('link[rel="stylesheet"][href*="styles"]');
    if (stylesheet) {
        if (theme === 'dark') {
            stylesheet.href = 'styles-dark.css';
        } else if (theme === 'gray') {
            stylesheet.href = 'styles-neutral.css';
        } else {
            stylesheet.href = 'styles.css';
        }
    }
    document.documentElement.dataset.theme = theme;
};

applyExamplesTheme();

window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
        applyExamplesTheme();
    }
});

function main() {
    // render out the app
    const container = document.getElementById('app');
    if (!container) {
        return;
    }
    const root = createRoot(container);
    root.render(jsx(MainLayout, null));
}

main();
