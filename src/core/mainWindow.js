/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

const {Adw, Gdk, Gio, GLib, GObject, Gtk, Sushi} = imports.gi;

const Constants = imports.util.constants;
const {ErrorRenderer} = imports.viewers.error;
const MimeHandler = imports.core.mimeHandler;
const Renderer = imports.core.renderer;
const {METADATA_KEY_CUSTOM_ICON,METADATA_KEY_CUSTOM_ICON_NAME} = imports.util.customIcon;

const WINDOW_MAX_W = 800;
const WINDOW_MAX_H = 600;
const WINDOW_MAX_W_BASE = 1368;
const WINDOW_MAX_H_BASE = 768;

function _getDecorationLayout() {
    function _isSupported(name) {
        // We don't support maximize and minimize
        return ['menu', 'close'].includes(name);
    }

    let settings = Gtk.Settings.get_default();
    let decorationLayout = settings.gtk_decoration_layout;
    let [lhs, rhs] = decorationLayout.split(':');

    let leftGroup = lhs.split(',').filter(_isSupported);
    let rightGroup = rhs ? rhs.split(',').filter(_isSupported) : [];

    return [leftGroup.join(','), rightGroup.join(',')].join(':');
};

function _getScaledSize(baseSize, allocSize, upscale) {
    let allocW = allocSize[0];
    let allocH = allocSize[1];
    let width = baseSize[0];
    let height = baseSize[1];
    let scale = 1.0;

    if (((width <= allocW && height <= allocH) && upscale) ||
        (width > allocW && height > allocH)) {
        /* up/downscale both directions */
        let allocRatio = allocW / allocH;
        let baseRatio = width / height;

        if (baseRatio > allocRatio)
            scale = allocW / width;
        else
            scale = allocH / height;
    } else if (width > allocW &&
            height <= allocH) {
        /* downscale x */
        scale = allocW / width;
    } else if (width <= allocW &&
            height > allocH) {
        /* downscale y */
        scale = allocH / height;
    }

    width *= scale;
    height *= scale;

    return [ Math.floor(width), Math.floor(height) ];
}

var MainWindow = GObject.registerClass(class MainWindow extends Adw.ApplicationWindow {
    _init(application) {
        this._renderer = null;
        this._lastWindowSize = [0, 0];
        this.file = null;

        super._init({ application: application });

        this._toolbar_view = new Adw.ToolbarView({ top_bar_style: Adw.ToolbarStyle.RAISED_BORDER});
        this.set_content(this._toolbar_view)

        this._titlebar = new Adw.HeaderBar({ decoration_layout: _getDecorationLayout() });
        this._fullscreen_button = new Gtk.Button({ icon_name: 'view-fullscreen-symbolic',
                                                   action_name: 'win.fullscreen'});
        this._titlebar.pack_start(this._fullscreen_button)
        this._toolbar_view.add_top_bar(this._titlebar);

        this._openButton = new Gtk.Button({ label: _("Open") });
        this._openButton.connect('clicked', this._onFileOpenClicked.bind(this));
        this._titlebar.pack_start(this._openButton);

        this._defineActions();
    }

    vfunc_unrealize() {
        super.vfunc_unrealize();
        this._renderer?.cancellable?.cancel();
    }

    _defineActions() {
        let quit = new Gio.SimpleAction({ name: 'quit' });
        quit.connect('activate', () => {
            this.close();
        });
        this.application.set_accels_for_action('win.quit', ['q', 'Escape', 'space']);
        this.add_action(quit);

        let fullscreen = new Gio.SimpleAction({ name: 'fullscreen' });
        fullscreen.connect('activate', () => {
            this._renderer.toggleFullscreen();
        });
        this.application.set_accels_for_action('win.fullscreen', ['f', 'F11']);
        this.add_action(fullscreen);

        var _addSelectAction = ((name, accel, direction) => {
            let action = new Gio.SimpleAction({ name: name });
            action.connect('activate', () => {
                this.application.emitSelectionEvent(direction);
            });

            this.application.set_accels_for_action(`win.${name}`, [accel]);
            this.add_action(action);
        });

        _addSelectAction('select-left', 'Left', Gtk.DirectionType.LEFT);
        _addSelectAction('select-right', 'Right', Gtk.DirectionType.RIGHT);
        _addSelectAction('select-up', 'Up', Gtk.DirectionType.UP);
        _addSelectAction('select-down', 'Down', Gtk.DirectionType.DOWN);
    }

    /** @param {GLib.Error} error
     *  @param {Gio.FileInfo|undefined} fileInfo */
    _reportError(error, fileInfo) {
        if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
          return;
        let renderer = new ErrorRenderer(error);
        this._embedRenderer(renderer);
        const title = (fileInfo?.get_display_name()
            ?? this.file.get_basename()
            ?? this.file.get_uri());
        this.set_title(title);
        this.set_resizable(this._renderer.resizable);
    }

    _onRendererFullscreen() {
        if (this._renderer.fullscreen) {
            this.fullscreen();
            this._fullscreen_button.set_icon_name('view-restore-symbolic');
        }
        else {
            this.unfullscreen();
            this._fullscreen_button.set_icon_name('view-fullscreen-symbolic');
        }
    }

    _onRendererReady() {
        if (this._renderer.ready) {
            this._resizeWindow();
            this.queue_resize();
        }
    }

    _getMaxSize() {
        let display = Gdk.Display.get_default();
        let surface = this.get_surface();
        let monitor = display.get_monitor_at_surface(surface);
        let geometry = monitor.get_geometry();

        let scaleW = geometry.width / WINDOW_MAX_W_BASE;
        let scaleH = geometry.height / WINDOW_MAX_H_BASE;

        return [Math.floor(scaleW * WINDOW_MAX_W),
                Math.floor(scaleH * WINDOW_MAX_H)];
    }

    _resizeWindow() {
        if (!this._renderer)
            return;

        if (this._renderer.fullscreen)
            return;

        let maxSize = this._getMaxSize();
        let rendererSize = this._renderer.get_preferred_size();
        let natSize = [rendererSize[1].width, rendererSize[1].height];
        if (natSize[0] <= Constants.VIEW_MIN) {
            natSize = natSize.map(size => Math.max(size, Constants.VIEW_MIN));
        }
        let windowSize;
        let resizePolicy = this._renderer.resizePolicy;

        if (resizePolicy == Renderer.ResizePolicy.MAX_SIZE)
            windowSize = maxSize;
        else if (resizePolicy == Renderer.ResizePolicy.NAT_SIZE)
            windowSize = natSize;
        else if (resizePolicy == Renderer.ResizePolicy.SCALED)
            windowSize = _getScaledSize(natSize, maxSize, false);
        else if (resizePolicy == Renderer.ResizePolicy.STRETCHED)
            windowSize = _getScaledSize(natSize, maxSize, true);

        const naturalTitlebarSize = this._titlebar.get_preferred_size()[1];
        windowSize[1] += naturalTitlebarSize.height;

        this._setDefaultSize(windowSize);
    }

    _setDefaultSize(windowSize) {
        if ((windowSize[0] > 0 && windowSize[0] != this._lastWindowSize[0]) ||
            (windowSize[1] > 0 && windowSize[1] != this._lastWindowSize[1])) {
            if (!this.get_settings().gtk_interface_reduced_motion && this._lastWindowSize[0] != 0) {
                const width_target = Adw.PropertyAnimationTarget.new(this, 'default-width');
                const height_target = Adw.PropertyAnimationTarget.new(this, 'default-height');
                const width_animation = Adw.TimedAnimation.new(this, this._lastWindowSize[0], windowSize[0], 150, width_target);
                const height_animation = Adw.TimedAnimation.new(this, this._lastWindowSize[1], windowSize[1], 150, height_target);
                width_animation.play()
                height_animation.play()
            } else {
                this.set_default_size(...windowSize);
            }
            this._lastWindowSize = windowSize;
        }
    }

    _createRenderer() {
        this.file.query_info_async(
            [Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
             Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
             Gio.FILE_ATTRIBUTE_STANDARD_ICON,
             Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
             Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
             Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
             METADATA_KEY_CUSTOM_ICON,
             METADATA_KEY_CUSTOM_ICON_NAME].join(','),
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null,
            (obj, res) => {
                try {
                    let fileInfo = obj.query_info_finish(res);
                    this._createView(fileInfo);
                } catch(e) {
                    this._reportError(e);
                }
            });
    }

    _embedRenderer(renderer) {
        this._renderer?.cancellable?.cancel();
        this._renderer = renderer;
        this._renderer.expand = true;
        this._toolbar_view.set_content(this._renderer);

        this._fullscreen_button.set_sensitive(this._renderer.canFullscreen);
        this._toolbar_view.set_top_bar_style(this._renderer.topBarStyle);
    }

    _createView(fileInfo) {
        let klass = MimeHandler.getKlass(fileInfo.get_content_type());
        let renderer = new klass(this.file, fileInfo);
        this._embedRenderer(renderer);

        renderer.connect('error', (r, err) => { this._reportError(err, fileInfo); });
        renderer.connect('notify::fullscreen', this._onRendererFullscreen.bind(this));
        renderer.connect('notify::ready', this._onRendererReady.bind(this));
        this._resizeWindow();
        this._onRendererReady();

        this.set_resizable(this._renderer.resizable);
        this.set_title(fileInfo.get_display_name());
    }

    _onFileOpenClicked() {
        let fileLauncher = new Gtk.FileLauncher({ file: this.file });
        fileLauncher.launch(null, null, (obj, result) => {
          obj.launch_finish(result);
          this.close();
        });
    }

    /**************************************************************************
     ************************ public methods **********************************
     **************************************************************************/
    setParent(handle) {
        Sushi.window_set_child_of_external(this, handle);
        this.application.updateParentHandle(handle);
    }

    setFile(file) {
        this.file = file;
        this._createRenderer();
    }
});
