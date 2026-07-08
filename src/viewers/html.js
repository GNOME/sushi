/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import Sushi from 'gi://Sushi';

import {registerWebProcessExtension} from '../util/webProcessExtensions.js';

Gio._promisify(Gio.File.prototype, 'load_bytes_async', 'load_bytes_finish');
Gio._promisify(Gtk.UriLauncher.prototype, 'launch', 'launch_finish');
Gio._promisify(Gtk.FileLauncher.prototype, 'launch', 'launch_finish');

let WebKit;
try {
    WebKit = (await import('gi://WebKit?version=6.0')).default;
} catch {
    /* ignored */
}

function _isAvailable() {
    return WebKit !== undefined;
}

import {Renderer} from '../core/renderer.js';

export const Klass = _isAvailable() ? class HTMLRenderer extends Gtk.Box {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/html.ui',
            InternalChildren: ['banner', 'webView'],
        }, this);

        registerWebProcessExtension(WebKit.WebContext.get_default());
    }

    #loader;

    constructor(file, fileInfo, constructProperties = {}) {
        GObject.type_ensure(WebKit.WebView);

        super(constructProperties);

        this.#loader = isMarkdownFile(fileInfo)
            ? new MarkdownFileLoader()
            : new HTMLFileLoader();

        this._webView.connect('create', this._onCreate.bind(this));

        this._onUserMessageReceived = this._onUserMessageReceived.bind(this);

        const context = this._webView.get_context();
        const userMessageReceivedHandler = context.connect('user-message-received', this._onUserMessageReceived);
        this.connect('unmap', () => context.disconnect(userMessageReceivedHandler));

        this._webView.connect('context-menu', this._onContextMenu.bind(this));
        if (pkg.name.endsWith('Devel'))
            this._enableDeveloperExtras();

        this.#loader.initialize(this._webView);
        this.#loadFile(file);

        this._webView.connect('load-failed', (view, loadEvent, uri, error) => {
            this.emit('error', error);
        });
    }

    cleanup() {
        this.#loader.cleanup?.();
    }

    /** @param {Gio.File} file */
    async #loadFile(file) {
        try {
            await this.#loader.load(file, this.cancellable);
            this.markReady();
        } catch (error) {
            this.emit('error', error);
        }
    }

    _onShowRemoteContentClicked() {
        this._banner.set_revealed(false);
        const message = WebKit.UserMessage.new('Sushi.EnableFetchRemoteResources', null);
        this._webView.get_context().send_message_to_all_extensions(message);
        this.#loader.reload();
    }

    /** @param {WebKit.WebContext} _webContext
     *  @param {WebKit.UserMessage} message
     *  @returns {boolean} */
    _onUserMessageReceived(_webContext, message) {
        if (message.get_name() === 'Sushi.PageHasRemoteResources')
            this._banner.set_revealed(true);
        return true;
    }

    /** @param {WebKit.WebView} _webView
     *  @param {WebKit.NavigationAction} action
     *  @returns {Gtk.Widget|null} */
    _onCreate(_webView, action) {
        const request = action.get_request();
        this._launchUri(request.get_uri());
        return null;
    }

    /** @param {WebKit.WebView} _webView
     *  @param {WebKit.ContextMenu} contextMenu
     *  @returns {boolean} */
    _onContextMenu(_webView, contextMenu) {
        for (const item of contextMenu.get_items()) {
            if (!isAllowedStockAction(item))
                contextMenu.remove(item);
        }
        return false; /* propagate the event further */
    }

    _enableDeveloperExtras() {
        const settings = this._webView.get_settings();
        settings.set_enable_developer_extras(true);
    }

    /** @param {string} uri */
    async _launchUri(uri) {
        try {
            await this._tryLaunchUri(uri);
        } catch (error) {
            console.warn(`failed to launch URI '${uri}': ${error}`);
        }
    }

    /** @param {string} uri */
    async _tryLaunchUri(uri) {
        const parent = this.get_root();
        const isFile = GLib.Uri.parse_scheme(uri).toLowerCase() === 'file';
        if (isFile) {
            const file = Gio.File.new_for_uri(uri);
            await Gtk.FileLauncher.new(file).launch(parent, this.cancellable);
        } else {
            await Gtk.UriLauncher.new(uri).launch(parent, this.cancellable);
        }
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
} : undefined;

const isMarkdownFile = fileInfo => {
    // [TODO] share with mainWindow
    const contentType = fileInfo.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE)
        ? fileInfo.get_content_type()
        : fileInfo.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_FAST_CONTENT_TYPE);
    // [TODO] constant
    return contentType === 'text/markdown';
};

class HTMLFileLoader {
    #webView;

    /** @param {WebKit.WebView} webView */
    initialize(webView) {
        this.#webView = webView;
    }

    /** @param {Gio.File} file
     *  @param {Gio.Cancellable cancellable} */
    load(file, _cancellable) {
        this.#webView.load_uri(file.get_uri());
        return Promise.resolve();
    }

    reload() {
        this.#webView.reload();
    }
}

class MarkdownFileLoader {
    #html;
    #uri;
    #webView;
    #fontStyleSheet;
    #documentFontNameHandleId = 0;
    #monospaceFontNameHandleId = 0;
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

        this.#documentFontNameHandleId = this.#styleManager.connect('notify::document-font-name', this.#updateFonts);
        this.#monospaceFontNameHandleId = this.#styleManager.connect('notify::monospace-font-name', this.#updateFonts);
        this.#updateFonts();
    }

    cleanup() {
        if (this.#documentFontNameHandleId) {
            this.#styleManager.disconnect(this.#documentFontNameHandleId);
            this.#documentFontNameHandleId = 0;
        }
        if (this.#monospaceFontNameHandleId) {
            this.#styleManager.disconnect(this.#monospaceFontNameHandleId);
            this.#monospaceFontNameHandleId = 0;
        }
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

    #updateFonts = () => {
        // Adapted from libadwaita:
        // <https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/src/adw-style-manager.c>

        const documentFont = Pango.FontDescription.from_string(this.#styleManager.documentFontName);
        const monospaceFont = Pango.FontDescription.from_string(this.#styleManager.monospaceFontName);

        let css = ':root {';
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
}

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
    return `${QUOTE}${escaped}${QUOTE}`
};

export const contentTypes = (() => {
    if (!_isAvailable())
        return [];
    let contentTypes = ['text/html', 'application/xhtml+xml'];
    if (Sushi.markdown_available())
        contentTypes = [...contentTypes, 'text/markdown'];
    return contentTypes;
})();

const ALLOWED_STOCK_ACTIONS = _isAvailable() ? new Set([
    WebKit.ContextMenuAction.NO_ACTION,
    WebKit.ContextMenuAction.OPEN_LINK_IN_NEW_WINDOW,
    WebKit.ContextMenuAction.COPY_LINK_TO_CLIPBOARD,
    WebKit.ContextMenuAction.OPEN_IMAGE_IN_NEW_WINDOW,
    WebKit.ContextMenuAction.COPY_IMAGE_TO_CLIPBOARD,
    WebKit.ContextMenuAction.COPY_IMAGE_URL_TO_CLIPBOARD,
    WebKit.ContextMenuAction.OPEN_FRAME_IN_NEW_WINDOW,
    WebKit.ContextMenuAction.COPY,
    WebKit.ContextMenuAction.CUT,
    WebKit.ContextMenuAction.PASTE,
    WebKit.ContextMenuAction.DELETE,
    WebKit.ContextMenuAction.SELECT_ALL,
    WebKit.ContextMenuAction.INPUT_METHODS,
    WebKit.ContextMenuAction.UNICODE,
    WebKit.ContextMenuAction.SPELLING_GUESS,
    WebKit.ContextMenuAction.NO_GUESSES_FOUND,
    WebKit.ContextMenuAction.IGNORE_SPELLING,
    WebKit.ContextMenuAction.LEARN_SPELLING,
    WebKit.ContextMenuAction.IGNORE_GRAMMAR,
    WebKit.ContextMenuAction.FONT_MENU,
    WebKit.ContextMenuAction.BOLD,
    WebKit.ContextMenuAction.ITALIC,
    WebKit.ContextMenuAction.UNDERLINE,
    WebKit.ContextMenuAction.OUTLINE,
    WebKit.ContextMenuAction.INSPECT_ELEMENT,
    WebKit.ContextMenuAction.OPEN_VIDEO_IN_NEW_WINDOW,
    WebKit.ContextMenuAction.COPY_VIDEO_LINK_TO_CLIPBOARD,
    WebKit.ContextMenuAction.COPY_AUDIO_LINK_TO_CLIPBOARD,
    WebKit.ContextMenuAction.TOGGLE_MEDIA_CONTROLS,
    WebKit.ContextMenuAction.TOGGLE_MEDIA_LOOP,
    WebKit.ContextMenuAction.ENTER_VIDEO_FULLSCREEN,
    WebKit.ContextMenuAction.MEDIA_PLAY,
    WebKit.ContextMenuAction.MEDIA_PAUSE,
    WebKit.ContextMenuAction.MEDIA_MUTE,
    WebKit.ContextMenuAction.INSERT_EMOJI,
    WebKit.ContextMenuAction.PASTE_AS_PLAIN_TEXT,
]) : new Set();

/** @param {WebKit.ContextMenuItem} item
 *  @returns {boolean} */
const isAllowedStockAction = item => {
    const action = item.get_stock_action();
    return ALLOWED_STOCK_ACTIONS.has(action);
};
