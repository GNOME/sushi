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

import {registerWebProcessExtension} from '../util/webProcessExtensions.js';

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

    constructor(file, _fileInfo, constructProperties = {}) {
        GObject.type_ensure(WebKit.WebView);

        super(constructProperties);

        this._webView.connect('create', this._onCreate.bind(this));

        this._onUserMessageReceived = this._onUserMessageReceived.bind(this);

        const context = this._webView.get_context();
        const userMessageReceivedHandler = context.connect('user-message-received', this._onUserMessageReceived);
        this.connect('unmap', () => context.disconnect(userMessageReceivedHandler));

        this._webView.connect('context-menu', this._onContextMenu.bind(this));
        if (pkg.name.endsWith('Devel'))
            this._enableDeveloperExtras();

        this._webView.load_uri(file.get_uri());
        this._webView.connect('load-failed', (view, loadEvent, uri, error) => {
            this.emit('error', error);
        });
        this.isReady();
    }

    _onShowRemoteContentClicked() {
        this._banner.set_revealed(false);
        const message = WebKit.UserMessage.new('Sushi.EnableFetchRemoteResources', null);
        this._webView.get_context().send_message_to_all_extensions(message);
        this._webView.reload();
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
            await Gtk.FileLauncher.new(file).launch(parent, this.getCancellable());
        } else {
            await Gtk.UriLauncher.new(uri).launch(parent, this.getCancellable());
        }
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
} : undefined;

export const mimeTypes = _isAvailable() ? ['text/html', 'application/xhtml+xml'] : [];

const ALLOWED_STOCK_ACTIONS = new Set([
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
]);

/** @param {WebKit.ContextMenuItem} item
 *  @returns {boolean} */
const isAllowedStockAction = item => {
    const action = item.get_stock_action();
    return ALLOWED_STOCK_ACTIONS.has(action);
};
