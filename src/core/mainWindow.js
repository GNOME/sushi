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
import {isCancelledError} from '../util/error.js';

const WINDOW_MAX_PERCENT_H = 0.5;
const WINDOW_MAX_PERCENT_W = 0.5;

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

    constructor(application) {
        const min_width = 340;
        const min_height = 294;

        super({
            application,
            height_request: min_height,
            width_request: min_width,
        });

        this.#setupActions();

        this._renderer = null;
        this._loadingRenderer = null;
        this._spinnerDelayId = 0;
        this._fileQueryCancellable = null;
        this._file = null;
        this._fileIsFolder = false;

        this._animating = 0;
        this._skip_next_size_adjustment = false;
        this._scaled_by_user = false;

        this._lastWindowWidth = min_width;
        this._lastWindowHeight = min_height;
        this.set_default_size(min_width, min_height);

        this._hoverManager = new HoverManager(this._toolbar_view, this._titlebar);

        this._checkScaledByUser = this._checkScaledByUser.bind(this);
        this.connect('notify::default-width', this._checkScaledByUser);
    }

    vfunc_close_request() {
        stopRenderer(this._loadingRenderer);
        stopRenderer(this._renderer);

        return super.vfunc_close_request();
    }

    get file() {
        return this._file;
    }

    set file(newFile) {
        this._file = newFile;
        this._createRenderer();
    }

    #setupActions() {
        const addAction = (name, callback) => {
            const action = new Gio.SimpleAction({name});
            action.connect_object('activate', callback, this, GObject.ConnectFlags.DEFAULT);
            this.add_action(action);
        };
        addAction('fullscreen', () => this.#toggleFullscreen());
        addAction('open-file', () => this.#openFile());
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
        if (isCancelledError(error))
            return;
        if (renderer && isRendererStopped(renderer)) {
            console.warn('error from stopped renderer', error);
            return;
        }
        this._embedRenderer(new ErrorRenderer(error), fileInfo);
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
        if (!this._renderer || this._scaled_by_user)
            return;

        const maxSize = this._getMaxSize();
        const contentSize = getRendererSize(this._renderer, maxSize);
        const naturalTitlebarSize = this._titlebar.get_preferred_size()[1];
        const width = Math.min(contentSize[0], maxSize[0]);
        const height = Math.min(contentSize[1] + naturalTitlebarSize.height, maxSize[1]);

        GObject.signal_handlers_block_by_func(this, this._checkScaledByUser);
        this.#setDefaultSize(width, height);
        GObject.signal_handlers_unblock_by_func(this, this._checkScaledByUser);
    }

    _checkScaledByUser() {
        if (this._skip_next_size_adjustment) {
            this._skip_next_size_adjustment = false;
        } else if (this._animating === 0) {
            console.debug('Window scaled by user, keeping size');
            this._scaled_by_user = true;
        }
    }

    _animationDone() {
        this._animating -= 1;
        // last size update arrives after animation is done
        this._skip_next_size_adjustment = true;
    }

    #setDefaultSize(width, height) {
        if ((width > 0 && width !== this._lastWindowWidth) ||
            (height > 0 && height !== this._lastWindowHeight)) {
            if (!this.get_settings().gtk_interface_reduced_motion && this._lastWindowWidth !== 0) {
                const width_target = Adw.PropertyAnimationTarget.new(this, 'default-width');
                const height_target = Adw.PropertyAnimationTarget.new(this, 'default-height');
                const width_animation = Adw.TimedAnimation.new(
                    this, this._lastWindowWidth, width, 150, width_target);
                const height_animation = Adw.TimedAnimation.new(
                    this, this._lastWindowHeight, height, 150, height_target);
                this._animating += 2;
                [width_animation, height_animation].map(animation => animation.connect_object(
                    'done',
                    () => this._animationDone(),
                    this, GObject.ConnectFlags.DEFAULT
                ));
                width_animation.play();
                height_animation.play();
            } else {
                this.set_default_size(width, height);
            }
            this._lastWindowWidth = width;
            this._lastWindowHeight = height;
        }
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
        if (this._spinnerDelayId)
            return;
        this._spinnerDelayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT_IDLE,
            200,
            () => {
                this.#setDisplayedWidget(this._spinner);
                this._spinnerDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _stopDelayedSpinner() {
        if (this._spinnerDelayId) {
            GLib.Source.remove(this._spinnerDelayId);
            this._spinnerDelayId = 0;
        }
    }

    _setRenderer() {
        this._stopDelayedSpinner();
        this._renderer = this._loadingRenderer;
        this._loadingRenderer = null;

        const toolbar = getRendererToolbar(this._renderer);
        let stackWidget = this._renderer;
        if (toolbar)
            stackWidget = new OverlayWrapper(this._renderer, toolbar, this._hoverManager);
        else
            this._hoverManager.setRevealer(null);
        this._mainStack.add_child(stackWidget);
        this.#setDisplayedWidget(stackWidget);

        this._resizeWindow();
        this.queue_resize();
        this._toolbar_view.set_top_bar_style(this._renderer.topBarStyle);
    }

    /** @param {import('./renderer.js').Renderer} renderer */
    _embedRenderer(renderer, fileInfo) {
        stopRenderer(this._renderer);
        stopRenderer(this._loadingRenderer);
        this._loadingRenderer = renderer;

        const title = fileInfo?.get_display_name() ??
            this._file.get_basename() ??
            this._file.get_uri();
        this.set_title(title);

        if (isRendererReady(renderer)) {
            this._setRenderer();
        } else {
            this._startDelayedSpinner();
            const rendererReadyId = renderer.connect_object(
                'ready',
                () => {
                    renderer.disconnect(rendererReadyId);
                    if (isRendererReady(renderer) && this._loadingRenderer === renderer)
                        this._setRenderer();
                },
                this, GObject.ConnectFlags.DEFAULT
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
        this._embedRenderer(renderer, fileInfo);
        this._fileIsFolder = fileInfo.get_file_type() === Gio.FileType.DIRECTORY;

        renderer.connect_object(
            'error',
            (renderer, err) => this._reportError(err, fileInfo, renderer),
            this, GObject.ConnectFlags.DEFAULT
        );
    }

    #openFile() {
        if (this._fileIsFolder) {
            this.get_application().activate_action('navigate', null);
            return;
        }

        const fileLauncher = new Gtk.FileLauncher({file: this._file});
        fileLauncher.launch(null, null, (obj, result) => {
            try {
                obj.launch_finish(result);
                this.close();
            } catch (error) {
                if (error === Gtk.DialogError.FAILED)
                    console.warn(error);
            }
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
