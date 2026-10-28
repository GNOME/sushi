// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import Sushi from 'gi://Sushi';
import WebKit from 'gi://WebKit';

import {Connection} from '../util/connection.js';

Gio._promisify(Gio.File.prototype, 'load_bytes_async', 'load_bytes_finish');

export const CONTENT_TYPE = 'text/markdown';

export const isAvailable = Sushi.markdown_available();

export const FileHandler = class MarkdownFileHandler {
    #html;
    #uri;
    #webView;
    #fontStyleSheet;
    #documentFontNameHandler;
    #monospaceFontNameHandle;
    #accentColorHandler;
    #styleManager = Adw.StyleManager.get_default();

    /** @param {WebKit.WebView} webView */
    initialize(webView) {
        this.#webView = webView;

        const cssBytes = Gio.resources_lookup_data(
            '/org/gnome/NautilusPreviewer/markdown.css',
            Gio.ResourceLookupFlags.NONE
        );
        const css = new TextDecoder().decode(cssBytes.toArray());
        const styleSheet = new WebKit.UserStyleSheet(
            css,
            WebKit.UserContentInjectedFrames.TOP_FRAME,
            WebKit.UserStyleLevel.USER,
            null,
            null
        );
        webView.get_user_content_manager().add_style_sheet(styleSheet);

        const jsBytes = Gio.resources_lookup_data(
            '/org/gnome/NautilusPreviewer/markdown.js',
            Gio.ResourceLookupFlags.NONE
        );
        const js = new TextDecoder().decode(jsBytes.toArray());
        const script = new WebKit.UserScript(
            js,
            WebKit.UserContentInjectedFrames.TOP_FRAME,
            WebKit.UserScriptInjectionTime.END,
            null,
            null
        );
        webView.get_user_content_manager().add_script(script);

        this.#accentColorHandler = new Connection('notify::accent-color-rgba', this.#updateCssVariables);
        this.#accentColorHandler.connect(this.#styleManager);
        this.#documentFontNameHandler = new Connection('notify::document-font-name', this.#updateCssVariables);
        this.#documentFontNameHandler.connect(this.#styleManager);
        this.#monospaceFontNameHandle = new Connection('notify::monospace-font-name', this.#updateCssVariables);
        this.#monospaceFontNameHandle.connect(this.#styleManager);
        this.#updateCssVariables();
    }

    cleanup() {
        this.#accentColorHandler.disconnect();
        this.#documentFontNameHandler.disconnect();
        this.#monospaceFontNameHandle.disconnect();
    }

    /** @param {Gio.File} file
     *  @param {Gio.Cancellable cancellable} */
    async load(file, cancellable) {
        const [markdown] = await file.load_bytes_async(cancellable);
        this.#html = Sushi.markdown_to_html(markdown);
        this.#uri = file.get_uri();
        this.#webView.load_bytes(this.#html, 'text/html', null, this.#uri);
    }

    /** @param {WebKit.WebView} webView */
    reload() {
        if (this.#html !== undefined && this.#uri !== undefined)
            this.#webView.load_bytes(this.#html, 'text/html', null, this.#uri);
    }

    #updateCssVariables = () => {
        // Adapted from libadwaita:
        // <https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/src/adw-style-manager.c>

        const documentFont = Pango.FontDescription.from_string(this.#styleManager.documentFontName);
        const monospaceFont = Pango.FontDescription.from_string(this.#styleManager.monospaceFontName);
        const accentColorRgba = this.#styleManager.get_accent_color_rgba();

        let css = ':root {';
        css += `--sushi-accent-color: ${accentColorRgba.to_string()};`;
        if (documentFont && (documentFont.get_set_fields() & Pango.FontMask.FAMILY !== 0))
            css += `--sushi-document-font-family: ${toCssString(documentFont.get_family())};`;
        if (documentFont && (documentFont.get_set_fields() & Pango.FontMask.SIZE !== 0))
            css += `--sushi-document-font-size: ${toCssFontSize(documentFont)};`;
        if (monospaceFont && (monospaceFont.get_set_fields() & Pango.FontMask.FAMILY !== 0))
            css += `--sushi-monospace-font-family: ${toCssString(monospaceFont.get_family())};`;
        if (monospaceFont && (monospaceFont.get_set_fields() & Pango.FontMask.SIZE !== 0))
            css += `--sushi-monospace-font-size: ${toCssFontSize(monospaceFont)};`;
        css += '}';

        const styleSheet = new WebKit.UserStyleSheet(
            css,
            WebKit.UserContentInjectedFrames.TOP_FRAME,
            WebKit.UserStyleLevel.USER,
            null,
            null
        );

        const userContentManager = this.#webView.get_user_content_manager();
        if (this.#fontStyleSheet)
            userContentManager.remove_style_sheet(this.#fontStyleSheet);

        this.#fontStyleSheet = styleSheet;
        userContentManager.add_style_sheet(styleSheet);
    };
};

/** @param {Pango.FontDescription} font  */
const toCssFontSize = font => {
    const size = font.get_size() / Pango.SCALE;
    return font.get_size_is_absolute() ? `${size}px` : `${size}pt`;
};

/** @param {string} value */
const toCssString = value => {
    // See <https://www.w3.org/TR/css-syntax-3/#typedef-string-token>
    const QUOTE = '"';
    const QUOTE_CODE_POINT = QUOTE.codePointAt(0).toString(16);
    const ESCAPE = '\\';
    const ESCAPE_CODE_POINT = ESCAPE.codePointAt(0).toString(16);
    const NEWLINE = '\n';
    const NEWLINE_CODE_POINT = NEWLINE.codePointAt(0).toString(16);
    const escaped = value
        .replace(ESCAPE, `${ESCAPE}${ESCAPE_CODE_POINT} `)
        .replace(QUOTE, `${ESCAPE}${QUOTE_CODE_POINT} `)
        .replace(NEWLINE, `${ESCAPE}${NEWLINE_CODE_POINT} `);
    return `${QUOTE}${escaped}${QUOTE}`;
};
