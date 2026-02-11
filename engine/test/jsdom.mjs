import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { JSDOM } from 'jsdom';

import * as pc from '../src/index.js';

let jsdom;

const DEFAULT_TEST_ORIGIN = 'http://localhost:3000';

const getFontSize = (fontValue) => {
    const match = /([0-9]+(?:\.[0-9]+)?)px/.exec(fontValue || '');
    return match ? Number(match[1]) : 10;
};

const createCanvasContext = () => {
    let fontValue = '10px sans-serif';

    return {
        fillStyle: '#000',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        clearRect() {},
        fillRect() {},
        fillText() {},
        measureText(text) {
            const fontSize = getFontSize(fontValue);
            return { width: String(text).length * fontSize * 0.6 };
        },
        get font() {
            return fontValue;
        },
        set font(value) {
            fontValue = value;
        }
    };
};

const resolveImageUrl = (value) => {
    try {
        const baseUrl = jsdom?.window?.location?.href || DEFAULT_TEST_ORIGIN;
        return new URL(value, baseUrl);
    } catch {
        return null;
    }
};

const fetchBuffer = (url, onSuccess, onError) => {
    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requestFn(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
            onError(new Error(`Image request failed with status ${res.statusCode}`));
            res.resume();
            return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => onSuccess(Buffer.concat(chunks)));
    });

    req.on('error', onError);
    req.end();
};

const parseImageSize = (buffer) => {
    if (buffer.length >= 24) {
        const pngSignature = [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        ];
        const isPng = pngSignature.every((byte, index) => buffer[index] === byte);
        if (isPng) {
            return {
                width: buffer.readUInt32BE(16),
                height: buffer.readUInt32BE(20)
            };
        }
    }

    return { width: 1, height: 1 };
};

class TestImage {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.crossOrigin = null;
        this.width = 0;
        this.height = 0;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this._src = '';
    }

    set src(value) {
        this._src = value;
        const resolved = resolveImageUrl(value);
        if (!resolved) {
            this._emitError(new Error('Invalid image url'));
            return;
        }

        fetchBuffer(resolved, (buffer) => {
            const { width, height } = parseImageSize(buffer);
            this.width = width;
            this.height = height;
            this.naturalWidth = width;
            this.naturalHeight = height;
            setTimeout(() => this.onload?.(), 0);
        }, (err) => this._emitError(err));
    }

    get src() {
        return this._src;
    }

    _emitError(err) {
        setTimeout(() => this.onerror?.(err), 0);
    }
}

export const jsdomSetup = () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';

    jsdom = new JSDOM(html, {
        resources: 'usable',         // Allow the engine to load assets
        runScripts: 'dangerously',   // Allow the engine to run scripts
        url: 'http://localhost:3000' // Set the URL of the document
    });

    // Copy the window and document to global scope
    global.window = jsdom.window;
    global.document = jsdom.window.document;

    const canvasProto = jsdom.window.HTMLCanvasElement?.prototype;
    if (canvasProto) {
        canvasProto.getContext = function (type) {
            if (type !== '2d') {
                return null;
            }

            if (!this._context2d) {
                this._context2d = createCanvasContext();
            }

            return this._context2d;
        };
    }

    // Copy the DOM APIs used by the engine to global scope
    global.ArrayBuffer = jsdom.window.ArrayBuffer;
    global.Audio = jsdom.window.Audio;
    global.DataView = jsdom.window.DataView;
    global.Image = TestImage;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;
    global.XMLHttpRequest = jsdom.window.XMLHttpRequest;

    // Worker shim
    global.Worker = class {
        constructor(stringUrl) {
            this.url = stringUrl;
        }

        postMessage(msg) {}

        terminate() {}

        onmessage = null;

        addEventListener() {}

        removeEventListener() {}
    };

    // Copy the PlayCanvas API to global scope (only required for 'classic' scripts)
    jsdom.window.pc = pc;
    jsdom.window.Image = TestImage;
};

export const jsdomTeardown = () => {
    jsdom = null;
};
