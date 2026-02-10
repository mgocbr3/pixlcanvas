export const playcanvasTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        {
            token: 'comment',
            foreground: '7F7F7F'
        }
    ],
    colors: {
        'editor.background': '#11141b'
    }
};

export const darkTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        {
            token: 'comment',
            foreground: '7F7F7F'
        }
    ],
    colors: {
        'editor.background': '#0b0c0e'
    }
};

export const neutralTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        {
            token: 'comment',
            foreground: '7F7F7F'
        }
    ],
    colors: {
        'editor.background': '#141414'
    }
};

export const getExamplesTheme = () => {
    const theme = window.localStorage.getItem('editor:theme');
    if (theme === 'gray') {
        return neutralTheme;
    }
    return theme === 'dark' ? darkTheme : playcanvasTheme;
};
