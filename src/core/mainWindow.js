/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {ErrorRenderer} from '../viewers/error.js';
import {FallbackRenderer} from '../viewers/fallback.js';
import {HoverManager} from '../util/hoverManager.js';
import {OverlayWrapper} from '../util/overlayWrapper.js';
import * as MimeHandler from './mimeHandler.js';
import {METADATA_KEY_CUSTOM_ICON, METADATA_KEY_CUSTOM_ICON_NAME} from '../util/customIcon.js';
import {getRendererToolbar, isRendererReady, stopRenderer, getRendererSize, isRendererStopped} from './renderer.js';
import {setupActions} from '../util/action.js';
import {Connection} from '../util/connection.js';
import {isCancelledError} from '../util/error.js';
import {SourceId} from '../util/source.js';

Gio._promisify(Gtk.FileLauncher.prototype, 'launch', 'launch_finish');

const MIN_WIDTH = 340;
const MIN_HEIGHT = 294;
const WINDOW_MAX_PERCENT_W = 0.5;
const WINDOW_MAX_PERCENT_H = 0.5;
const ACCEPTABLE_USER_ACTION_DELAY_IN_MS = 200;

export class MainWindow extends Adw.ApplicationWindow {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/mainWindow.ui',
            InternalChildren: [
                'toolbar_view', 'titlebar', 'fullscreen_button', 'mainStack', 'spinner',
            ],
            Properties: {
                file: GObject.ParamSpec.object(
                    'file',
                    'Current File',
                    null,
                    GObject.ParamFlags.READWRITE | GObject.ParamFlags.STATIC_NAME,
                    Gio.File
                ),
            },
        }, this);
    }

    #renderer = null;
    #errorHandleId = new Connection();
    #readyHandleId = new Connection();
    #requestedDefaultWidth = MIN_WIDTH;
    #requestedDefaultHeight = MIN_HEIGHT;
    #scaledByUser = false;
    #spinnerDelayId = new SourceId();
    #presentTimeoutId = new SourceId();
    #retrySetDefaultSizeTimeoutId = new SourceId();
    #recentlyReceivedFocus = false;

    constructor(application) {
        super({
            application,
            widthRequest: MIN_WIDTH,
            heightRequest: MIN_HEIGHT,
            defaultWidth: MIN_WIDTH,
            defaultHeight: MIN_HEIGHT,
        });

        setupActions(this, 'win', [
            ['fullscreen', () => this.#toggleFullscreen()],
            ['open-file', () => this.#openFile()],
        ]);

        this._fileQueryCancellable = null;
        this._file = null;
        this._fileIsFolder = false;

        this._animating = 0;

        this._hoverManager = new HoverManager(this._toolbar_view, this._titlebar);

        this.connect('notify::default-width', this.#checkScaledByUser);
        this.connect('notify::default-height', this.#checkScaledByUser);
        this.connect('notify::is-active', this.#onIsActiveChanged);
    }

    vfunc_close_request() {
        this.#cleanupRenderer();
        this.#spinnerDelayId.remove();
        this.#presentTimeoutId.remove();
        this.#retrySetDefaultSizeTimeoutId.remove();
        this._hoverManager.cleanup();
        this._fileQueryCancellable?.cancel();

        return super.vfunc_close_request();
    }

    get file() {
        return this._file;
    }

    set file(newFile) {
        this._file = newFile;
        this._createRenderer();
    }

    presentWhenReady() {
        if (!this.visible) {
            // Window is shown for the first time
            this.#presentWhenReady();
        } else {
            this.#recentlyReceivedFocus = true;
            this.present();
        }
    }

    #presentWhenReady() {
        if (!this.#presentTimeoutId.added) {
            this.#presentTimeoutId.timeoutAddOnce(
                GLib.G_PRIORITY_HIGH,
                ACCEPTABLE_USER_ACTION_DELAY_IN_MS,
                () => this.present());
        }
    }

    #onIsActiveChanged = () => {
        if (this.isActive)
            this.#presentTimeoutId.remove();
    };

    #setupErrorHandling(fileInfo) {
        if (!(this.#renderer instanceof ErrorRenderer)) {
            this.#errorHandleId.connect(
                this.#renderer,
                'error',
                (renderer, err) => this._reportError(err, fileInfo, renderer)
            );
        }
    }

    _getDecorationLayout() {
        const layout_groups = Gtk.Settings.get_default().gtk_decoration_layout.split(':');
        const has_close = layout_groups.map(group => group.split(',').includes('close'));

        // We only support a close button
        if (has_close[0])
            return 'close:';
        else if (has_close[1])
            return ':close';
        else
            return '';
    }

    /** @param {GLib.Error} error
     *  @param {Gio.FileInfo|undefined} fileInfo
     *  @param {import('./renderer.js').Renderer|undefined} renderer */
    _reportError(error, fileInfo, renderer) {
        this.#errorHandleId.disconnect();
        if (isCancelledError(error))
            return;
        if (renderer && isRendererStopped(renderer)) {
            console.warn('error from stopped renderer', error);
            return;
        }
        this.#loadRenderer(new ErrorRenderer(error), fileInfo);
    }

    /** @returns {[number, number]} */
    _getMaxSize() {
        const display = Gdk.Display.get_default();
        const surface = this.get_surface();
        const monitor = display.get_monitor_at_surface(surface);
        const geometry = monitor.get_geometry();

        // Sanitize unexpected values
        if (geometry.width > 100_000)
            geometry.width = 800;
        if (geometry.height > 100_000)
            geometry.height = 800;

        return [Math.floor(geometry.width * WINDOW_MAX_PERCENT_W),
            Math.floor(geometry.height * WINDOW_MAX_PERCENT_H)];
    }

    _resizeWindow() {
        if (this.#scaledByUser)
            return;

        const maxSize = this._getMaxSize();
        const contentSize = getRendererSize(this.#renderer, maxSize);
        const naturalTitlebarSize = this._titlebar.get_preferred_size()[1];
        const width = Math.min(contentSize[0], maxSize[0]);
        const height = Math.min(contentSize[1], maxSize[1]) + naturalTitlebarSize.height;

        this.#setDefaultSize(width, height);
    }

    #checkScaledByUser = () => {
        const sizeMatchesRequested =
            this.defaultWidth === this.#requestedDefaultWidth &&
            this.defaultHeight === this.#requestedDefaultHeight;
        if (!sizeMatchesRequested && this._animating === 0) {
            console.debug('Window scaled by user, keeping size');
            this.#scaledByUser = true;
        }
    };

    _animationDone() {
        this._animating -= 1;
    }

    /** @param {number} width
     *  @param {number} height */
    #setDefaultSize(width, height) {
        if ((width === 0 || width === this.#requestedDefaultWidth) &&
            (height === 0 || height === this.#requestedDefaultHeight))
            return;

        this.#requestedDefaultWidth = Math.max(width, MIN_WIDTH);
        this.#requestedDefaultHeight = Math.max(height, MIN_HEIGHT);

        if (!this.get_settings().gtk_interface_reduced_motion) {
            const width_target = Adw.PropertyAnimationTarget.new(this, 'default-width');
            const height_target = Adw.PropertyAnimationTarget.new(this, 'default-height');
            const width_animation = Adw.TimedAnimation.new(
                this, this.defaultWidth, this.#requestedDefaultWidth, 150, width_target);
            const height_animation = Adw.TimedAnimation.new(
                this, this.defaultHeight, this.#requestedDefaultHeight, 150, height_target);
            this._animating += 2;
            [width_animation, height_animation].map(animation => animation.connect_object(
                'done',
                () => this._animationDone(),
                this, GObject.ConnectFlags.DEFAULT
            ));
            width_animation.play();
            height_animation.play();
        } else {
            this.set_default_size(this.#requestedDefaultWidth, this.#requestedDefaultHeight);
            this.#retrySetDefaultSizeTimeoutId.remove();
            // When Sushi re-gains focus, window size changes are
            // sometimes not applied until the user hovers the window.
            // Setting the size again after a short delay fixes that.
            if (this.#recentlyReceivedFocus) {
                this.#retrySetDefaultSizeTimeoutId.timeoutAddOnce(
                    GLib.G_PRIORITY_DEFAULT,
                    50,
                    () => this.set_default_size(this.#requestedDefaultWidth, this.#requestedDefaultHeight));
            }
        }

        this.#recentlyReceivedFocus = false;
    }

    _createRenderer() {
        this._fileQueryCancellable?.cancel();
        this._fileQueryCancellable = new Gio.Cancellable();
        this._file.query_info_async(
            [Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
                Gio.FILE_ATTRIBUTE_STANDARD_FAST_CONTENT_TYPE,
                Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
                Gio.FILE_ATTRIBUTE_STANDARD_ICON,
                Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
                Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
                Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
                METADATA_KEY_CUSTOM_ICON,
                METADATA_KEY_CUSTOM_ICON_NAME].join(','),
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT,
            this._fileQueryCancellable,
            (obj, res) => {
                this._fileQueryCancellable = null;
                let fileInfo;
                try {
                    fileInfo = obj.query_info_finish(res);
                    this._createView(fileInfo);
                } catch (e) {
                    this._reportError(e, fileInfo);
                }
            });
    }

    #setDisplayedWidget(widget) {
        const previousWidget = this._mainStack.get_visible_child();
        this._mainStack.set_visible_child(widget);
        if (previousWidget && previousWidget !== this._spinner)
            this._mainStack.remove(previousWidget);
    }

    _startDelayedSpinner() {
        if (this.#spinnerDelayId.added)
            return;
        this.#spinnerDelayId.timeoutAddOnce(
            GLib.PRIORITY_DEFAULT_IDLE,
            ACCEPTABLE_USER_ACTION_DELAY_IN_MS,
            () => this.#setDisplayedWidget(this._spinner));
    }

    #embedRenderer() {
        this.#readyHandleId.disconnect();
        this.#spinnerDelayId.remove();

        const toolbar = getRendererToolbar(this.#renderer);
        let stackWidget = this.#renderer;
        if (toolbar)
            stackWidget = new OverlayWrapper(this.#renderer, toolbar, this._hoverManager);
        else
            this._hoverManager.setRevealer(null);
        this._mainStack.add_child(stackWidget);
        this.#setDisplayedWidget(stackWidget);

        this._resizeWindow();
        this.queue_resize();
        this._toolbar_view.set_top_bar_style(this.#renderer.topBarStyle);
        this.present();
    }

    #cleanupRenderer() {
        this.#errorHandleId.disconnect();
        this.#readyHandleId.disconnect();
        stopRenderer(this.#renderer);
    }

    /** @param {import('./renderer.js').Renderer} renderer */
    #loadRenderer(renderer, fileInfo) {
        this.#cleanupRenderer();
        this.#renderer = renderer;

        const title = fileInfo?.get_display_name() ??
            this._file.get_basename() ??
            this._file.get_uri();
        this.set_title(title);

        this.#setupErrorHandling(fileInfo);

        if (isRendererReady(renderer)) {
            this.#embedRenderer();
        } else {
            this._startDelayedSpinner();
            this.#readyHandleId.connect(
                renderer, 'ready',
                () => this.#embedRenderer()
            );
        }
    }

    /** @param {Gio.FileInfo} fileInfo */
    _createView(fileInfo) {
        const content_type = fileInfo.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE)
            ? fileInfo.get_content_type()
            : fileInfo.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_FAST_CONTENT_TYPE);
        const renderer = content_type
            ? new (MimeHandler.getKlass(content_type))(this._file, fileInfo)
            : new FallbackRenderer(this._file, fileInfo);
        this.#loadRenderer(renderer, fileInfo);
        this._fileIsFolder = fileInfo.get_file_type() === Gio.FileType.DIRECTORY;
    }

    #openFile() {
        if (this._fileIsFolder) {
            this.get_application().activate_action('navigate', null);
            return;
        }

        const fileLauncher = new Gtk.FileLauncher({file: this._file});
        fileLauncher.launch(this, null)
            .then(() => this.close())
            .catch(error => {
                if (error === Gtk.DialogError.FAILED)
                    console.warn(error);
            });
    }

    #toggleFullscreen() {
        const fullscreened = this.is_fullscreen();
        if (!fullscreened) {
            this.fullscreen();
            this._fullscreen_button.set_icon_name('view-restore-symbolic');
        } else {
            this.unfullscreen();
            this._fullscreen_button.set_icon_name('view-fullscreen-symbolic');
        }
        this._hoverManager.setFullscreened(!fullscreened);
    }
}
