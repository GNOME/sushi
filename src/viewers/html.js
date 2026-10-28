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
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {isGLibError} from '../util/error.js';
import {registerWebProcessExtension} from '../util/webProcessExtensions.js';
import {Renderer, PluginUnavailableError} from '../core/renderer.js';

Gio._promisify(Gtk.UriLauncher.prototype, 'launch', 'launch_finish');
Gio._promisify(Gtk.FileLauncher.prototype, 'launch', 'launch_finish');

let WebKit;
try {
    WebKit = (await import('gi://WebKit?version=6.0')).default;
} catch (error) {
    throw new PluginUnavailableError('WebKit is missing', {cause: error});
}

import * as Markdown from './html-markdown.js';

export const Klass = class HTMLRenderer extends Gtk.Box {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/html.ui',
            InternalChildren: ['banner', 'webView'],
        }, this);

        registerWebProcessExtension(WebKit.WebContext.get_default());
    }

    #file;
    #handler;

    constructor(file, fileInfo, constructProperties = {}) {
        GObject.type_ensure(WebKit.WebView);

        super(constructProperties);

        this.#file = file;

        const contentType = fileInfo.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE)
            ? fileInfo.get_content_type()
            : fileInfo.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_FAST_CONTENT_TYPE);
        this.#handler = contentType === Markdown.CONTENT_TYPE
            ? new Markdown.FileHandler()
            : new HTMLFileHandler();

        this._webView.connect('create', this._onCreate.bind(this));
        this._webView.connect('decide-policy', this.#decidePolicy);

        this._onUserMessageReceived = this._onUserMessageReceived.bind(this);

        const context = this._webView.get_context();
        const userMessageReceivedHandler = context.connect('user-message-received', this._onUserMessageReceived);
        this.connect('unmap', () => context.disconnect(userMessageReceivedHandler));

        this._webView.connect('context-menu', this._onContextMenu.bind(this));
        if (pkg.name.endsWith('Devel'))
            this._enableDeveloperExtras();

        this._webView.get_settings().set_enable_smooth_scrolling(true);

        this.#handler.initialize(this._webView);

        this._webView.connect('load-failed', (_view, _loadEvent, _uri, error) => {
            this.markFailed(error);
        });
        this.#loadFile(file);
    }

    cleanup() {
        this.#handler.cleanup?.();
    }

    async #loadFile() {
        try {
            await this.#handler.load(this.#file, this.cancellable);
            this.markReady();
        } catch (error) {
            this.markFailed(error);
        }
    }

    _onShowRemoteContentClicked() {
        this._banner.set_revealed(false);
        const message = WebKit.UserMessage.new('Sushi.EnableFetchRemoteResources', null);
        this._webView.get_context().send_message_to_all_extensions(message);
        this.#handler.reload();
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

    /** @param {WebKit.WebView} _webView
     *  @param {WebKit.PolicyDecision} decision
     *  @param {WebKit.PolicyDecisionType} decision
     *  @returns {boolean} */
    #decidePolicy = (_webView, decision, decisionType) => {
        if (decisionType === WebKit.PolicyDecisionType.NAVIGATION_ACTION)
            return this.#decideNavigationPolicy(decision);
        return false; /* propagate the event further */
    };

    /** @param {WebKit.NavigationPolicyDecision} decision
     *  @returns {boolean} */
    #decideNavigationPolicy(decision) {
        const action = decision.get_navigation_action();
        const request = action.get_request();
        const uri = request.get_uri();
        const scheme = GLib.Uri.parse_scheme(uri).toLowerCase();
        if (!WEB_URI_SCHEMES.has(scheme)) {
            decision.ignore();
            this._launchUri(uri);
            return true;
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
            if (!isGLibError(error, Gtk.DialogError, Gtk.DialogError.DISMISSED))
                console.warn(`failed to launch URI '${uri}': ${error}`);
        }
    }

    /** @param {string} uri */
    async _tryLaunchUri(uri) {
        const parent = this.get_root();
        const scheme = GLib.Uri.parse_scheme(uri).toLowerCase();
        if (scheme === 'file') {
            const file = Gio.File.new_for_uri(uri);
            await Gtk.FileLauncher.new(file).launch(parent, this.cancellable);
        } else if (LAUNCHABLE_URI_SCHEMES.has(scheme) || await this.#askForPermission(scheme)) {
            await Gtk.UriLauncher.new(uri).launch(parent, this.cancellable);
        }
    }

    #askForPermission(scheme) {
        const heading = _('Open in External App?');
        const body = Format.vprintf(_('Allow “%s” to open the “%s” link in an external app'), [this.#file.get_basename(), scheme]);
        const dialog = Adw.AlertDialog.new(heading, body);
        dialog.add_response('cancel', _('_Cancel'));
        dialog.add_response('open', _('_Open Link'));
        dialog.set_response_appearance('open', Adw.ResponseAppearance.SUGGESTED);
        dialog.set_default_response('open');

        return new Promise((resolve, _) => {
            dialog.connect_object('response', (_, response) => resolve(response === 'open'), this, GObject.ConnectFlags.DEFAULT);
            dialog.present(this);
        });
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
};

export const contentTypes = (() => {
    let contentTypes = ['text/html', 'application/xhtml+xml'];
    if (Markdown.isAvailable)
        contentTypes = [...contentTypes, 'text/markdown'];
    return contentTypes;
})();

class HTMLFileHandler {
    #webView;

    /** @param {WebKit.WebView} webView */
    initialize(webView) {
        this.#webView = webView;
    }

    /** @param {Gio.File} file
     *  @param {Gio.Cancellable cancellable} */
    load(file, _cancellable) {
        this.#webView.load_uri(file.get_uri());
    }

    reload() {
        this.#webView.reload();
    }
}

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

const LAUNCHABLE_URI_SCHEMES = new Set(['http', 'https', 'mailto']);
// Adapted from Epiphany: <https://gitlab.gnome.org/GNOME/epiphany/-/blob/main/embed/ephy-embed-utils.c#L142>
const WEB_URI_SCHEMES = new Set(['http', 'https', 'file', 'javascript', 'data', 'blob', 'about', 'gopher']);
