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
import * as MimeHandler from './mimeHandler.js';
import {ResizePolicy} from './renderer.js';
import {METADATA_KEY_CUSTOM_ICON, METADATA_KEY_CUSTOM_ICON_NAME} from '../util/customIcon.js';

const WINDOW_MAX_PERCENT_H = 0.5;
const WINDOW_MAX_PERCENT_W = 0.5;

export class MainWindow extends Adw.ApplicationWindow {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/mainWindow.ui',
            InternalChildren: ['toolbar_view', 'titlebar', 'fullscreen_button'],
        }, this);
    }

    constructor(application, actions) {
        const min_width = 340;
        const min_height = 294;

        super({
            application,
            height_request: min_height,
            width_request: min_width,
        });

        actions.map(action => this.add_action(action));

        this._renderer = null;
        this._fileQueryCancellable = null;
        this.file = null;

        this._animating = 0;
        this._skip_next_size_adjustment = false;
        this._scaled_by_user = false;

        this._lastWindowSize = [min_width, min_height];
        this.set_default_size(min_width, min_height);

        this._checkScaledByUser = this._checkScaledByUser.bind(this);
        this.connect('notify::default-width', this._checkScaledByUser);
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
     *  @param {Gio.FileInfo|undefined} fileInfo */
    _reportError(error, fileInfo) {
        if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
            return;
        this._embedRenderer(new ErrorRenderer(error), fileInfo);
    }

    _onRendererReady() {
        if (this._renderer.ready) {
            this._resizeWindow();
            this.queue_resize();
        }
    }

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

    _getContentSize() {
        const maxSize = this._getMaxSize();
        const rendererSize = this._renderer.get_preferred_size();
        const natSize = [rendererSize[1].width, rendererSize[1].height];

        switch (this._renderer.resizePolicy) {
        case ResizePolicy.CUSTOM: {
            const customSize = this._renderer.customSize;
            if (customSize) {
                const min = Math.min(customSize[0], maxSize[0]);
                const max = Math.min(customSize[1], maxSize[1]);
                return [min, max];
            } else {
                console.error('ResizePolicy programming error');
                return [1, 1];
            }
        }
        case ResizePolicy.MAX_SIZE:
            return maxSize;
        case ResizePolicy.NAT_SIZE:
            return [Math.min(natSize[0], maxSize[0]),
                Math.min(natSize[1], maxSize[1])];
        case ResizePolicy.SCALED:
            if (natSize[0] <= maxSize[0] && natSize[1] <= maxSize[1]) {
                // no scaling needed
                return natSize;
            } else {
                // scale by smaller ratio of width or height
                const ratio = Math.min(maxSize[0] / natSize[0], maxSize[1] / natSize[1]);
                return natSize.map(size => Math.floor(size * ratio));
            }
        case ResizePolicy.STATUS_PAGE:
            return [Math.min(400, maxSize[0]),
                Math.min(420, maxSize[1])];
        default:
            console.warn(`Renderer uses unknown resize policy '${this._renderer.resizePolicy}'`);
            return maxSize;
        }
    }

    _resizeWindow() {
        if (!this._renderer || this._scaled_by_user)
            return;

        if (this._renderer.fullscreen)
            return;

        const contentSize = this._getContentSize();
        const naturalTitlebarSize = this._titlebar.get_preferred_size()[1];
        const windowSize = [contentSize[0],
            contentSize[1] + naturalTitlebarSize.height];

        GObject.signal_handlers_block_by_func(this, this._checkScaledByUser);
        this._setDefaultSize(windowSize);
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

    _setDefaultSize(windowSize) {
        if ((windowSize[0] > 0 && windowSize[0] !== this._lastWindowSize[0]) ||
            (windowSize[1] > 0 && windowSize[1] !== this._lastWindowSize[1])) {
            if (!this.get_settings().gtk_interface_reduced_motion && this._lastWindowSize[0] !== 0) {
                const width_target = Adw.PropertyAnimationTarget.new(this, 'default-width');
                const height_target = Adw.PropertyAnimationTarget.new(this, 'default-height');
                const width_animation = Adw.TimedAnimation.new(this, this._lastWindowSize[0], windowSize[0], 150, width_target);
                const height_animation = Adw.TimedAnimation.new(this, this._lastWindowSize[1], windowSize[1], 150, height_target);
                this._animating += 2;
                [width_animation, height_animation].map(animation => animation.connect_object(
                    'done',
                    () => this._animationDone(),
                    this, GObject.ConnectFlags.DEFAULT
                ));
                width_animation.play();
                height_animation.play();
            } else {
                this.set_default_size(...windowSize);
            }
            this._lastWindowSize = windowSize;
        }
    }

    _createRenderer() {
        this._fileQueryCancellable?.cancel();
        this._fileQueryCancellable = new Gio.Cancellable();
        this.file.query_info_async(
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

    _embedRenderer(renderer, fileInfo) {
        this._renderer?.stopRenderer();
        this._renderer = renderer;

        const title = fileInfo?.get_display_name() ??
            this.file.get_basename() ??
            this.file.get_uri();
        this.set_title(title);

        this._toolbar_view.set_content(this._renderer);
        this._toolbar_view.set_top_bar_style(this._renderer.topBarStyle);

        if (renderer.ready) {
            this._onRendererReady();
        } else {
            renderer.connect_object(
                'ready',
                () => this._onRendererReady(),
                this, GObject.ConnectFlags.DEFAULT
            );
        }
    }

    _createView(fileInfo) {
        const content_type = fileInfo.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE)
            ? fileInfo.get_content_type()
            : fileInfo.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_FAST_CONTENT_TYPE);
        const renderer = content_type
            ? new (MimeHandler.getKlass(content_type))(this.file, fileInfo)
            : new FallbackRenderer(this.file, fileInfo);
        this._embedRenderer(renderer, fileInfo);

        renderer.connect_object(
            'error',
            (_, err) => this._reportError(err, fileInfo),
            this, GObject.ConnectFlags.DEFAULT
        );
    }

    _onFileOpenClicked() {
        const fileLauncher = new Gtk.FileLauncher({file: this.file});
        fileLauncher.launch(null, null, (obj, result) => {
            obj.launch_finish(result);
            this.close();
        });
    }

    /** ************************************************************************
     ************************ public methods **********************************
     **************************************************************************/
    setFile(file) {
        this.file = file;
        this._createRenderer();
    }

    toggleFullscreen() {
        if (!this.is_fullscreen()) {
            this.fullscreen();
            this._fullscreen_button.set_icon_name('view-restore-symbolic');
        } else {
            this.unfullscreen();
            this._fullscreen_button.set_icon_name('view-fullscreen-symbolic');
        }
    }
}
