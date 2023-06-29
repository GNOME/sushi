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

const {Gdk, Gio, GLib, GObject, Gtk, Sushi} = imports.gi;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;
const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

const WINDOW_MAX_W = 800;
const WINDOW_MAX_H = 600;
const WINDOW_MAX_W_BASE = 1368;
const WINDOW_MAX_H_BASE = 768;

const Embed = GObject.registerClass(class Embed extends Gtk.Overlay {
    vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }

    vfunc_get_preferred_width() {
        let [min, nat] = super.vfunc_get_preferred_width();

        min = Math.max(min, Constants.VIEW_MIN);
        nat = Math.max(nat, Constants.VIEW_MIN);

        return [min, nat];
    }

    vfunc_get_preferred_height_for_width(forWidth) {
        let [min, nat] = super.vfunc_get_preferred_height_for_width(forWidth);

        if (forWidth <= Constants.VIEW_MIN) {
            min = Math.max(min, Constants.VIEW_MIN);
            nat = Math.max(nat, Constants.VIEW_MIN);
        }

        return [min, nat];
    }
});

const ErrorBox = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class ErrorBox extends Gtk.Grid {
    _init(file, error) {
        super._init({ orientation: Gtk.Orientation.VERTICAL,
                      row_spacing: 12,
                      hexpand: true,
                      vexpand: true,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.CENTER });

        let image = new Gtk.Image({ pixel_size: 128,
                                    icon_name: 'face-uncertain-symbolic',
                                    halign: Gtk.Align.CENTER,
                                    valign: Gtk.Align.CENTER });
        this.add(image);

        // TRANSLATORS: This is a filename, e.g. "image.jpg"
        let primary = _("Unable to display %s").format(file.get_basename());
        let primaryMarkup = '<big><b>%s</b></big>'.format(GLib.markup_escape_text(primary, -1));
        let primaryLabel = new Gtk.Label({ label: primaryMarkup,
                                           use_markup: true,
                                           halign: Gtk.Align.CENTER,
                                           valign: Gtk.Align.CENTER });
        this.add(primaryLabel);

        let secondaryLabel = new Gtk.Label({ label: error.message,
                                             wrap: true,
                                             halign: Gtk.Align.CENTER,
                                             valign: Gtk.Align.CENTER });
        this.add(secondaryLabel);

        this.show_all();
    }
});

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

var MainWindow = GObject.registerClass(class MainWindow extends Gtk.ApplicationWindow {
    _init(application) {
        this._renderer = null;
        this._lastWindowSize = [0, 0];
        this.file = null;

        super._init({ type: Gtk.WindowType.TOPLEVEL,
                      skipPagerHint: true,
                      skipTaskbarHint: true,
                      windowPosition: Gtk.WindowPosition.CENTER,
                      gravity: Gdk.Gravity.CENTER,
                      application: application });

        this._titlebar = new Gtk.HeaderBar({ show_close_button: true,
                                             decoration_layout: _getDecorationLayout() });
        this.set_titlebar(this._titlebar);

        this._openButton = new Gtk.Button();
        this._openButton.connect('clicked', this._onFileOpenClicked.bind(this));
        this._titlebar.pack_end(this._openButton);

        this.connect('motion-notify-event', this._onMotionNotifyEvent.bind(this));
        this.connect('realize', this._onRealize.bind(this));

        let eventBox = new Gtk.EventBox({ visible_window: false });
        eventBox.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this.add(eventBox);

        this._embed = new Embed();
        eventBox.add(this._embed);

        // call show_all() early when there's still no child Renderer, because show_all() later
        // when the Renderer is a child may have unexpected results, see comments in !49
        this.show_all();

        // but leave MainWindow not visible, because we want it to be firstly shown/mapped
        // when it has its final dimemnsions i.e. when the Renderer has emmitted the 'ready'
        // signal, i.e. on the _onRendererReady() handler.
        this.hide();

        this._defineActions();
    }

    _onRealize() {
        // don't support maximize and minimize
        this.get_window().set_functions(Gdk.WMFunction.MOVE |
                                        Gdk.WMFunction.RESIZE |
                                        Gdk.WMFunction.CLOSE);
    }

    _defineActions() {
        let quit = new Gio.SimpleAction({ name: 'quit' });
        quit.connect('activate', () => {
            this.destroy();
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

    _onButtonPressEvent(window, event) {
        if (!this._renderer.moveOnClick)
            return false;

        let [, rootX, rootY] = event.get_root_coords();
        let [, button] = event.get_button();
        this.begin_move_drag(button,
                             rootX, rootY,
                             event.get_time());

        return false;
    }

    _onMotionNotifyEvent() {
        if (this._renderer.toolbar)
            this._renderer.toolbar.resetTimeout();
        return false;
    }

    _reportError(error) {
        let renderer = new ErrorBox(this.file, error);
        this._embedRenderer(renderer);
    }

    _onRendererFullscreen() {
        if (this._renderer.fullscreen)
            this.fullscreen();
        else
            this.unfullscreen();
    }

    _onRendererReady() {
        if (this._renderer.ready) {
            this._resizeWindow();
            this.queue_resize();
            this.show();
        }

    }

    _getMaxSize() {
        let gdkWin = this.get_window();
        let display = this.get_display();
        let underWayland = Sushi.running_under_wayland(display);
        let monitor = display.get_monitor_at_window(gdkWin);
        let geometry = monitor.get_geometry();

        // Scale our maximum with the actual monitor geometry
        let scaleW = 1.0;
        let scaleH = 1.0;

        // FIXME: We can only trust GTK >= 3.24.9 to report the right
        // monitor geometry under Wayland when fractional scaling is enabled.
        // Disable the scaling logic for older GTK versions.
        // See https://gitlab.gnome.org/GNOME/gtk/issues/1828
        let versionCheck = Gtk.check_version(3, 24, 9);
        if (!versionCheck) {
            scaleW = (geometry.width / WINDOW_MAX_W_BASE);
            scaleH = (geometry.height / WINDOW_MAX_H_BASE);
        }

        // reduce by scale factor only under Wayland, otherwise
        // X11 HiDPI windows are shown too small -- Issue #91
        if (underWayland) {
            scaleW = scaleW / this.get_scale_factor ();
            scaleH = scaleH / this.get_scale_factor ();
        }

        return [Math.floor(scaleW * WINDOW_MAX_W),
                Math.floor(scaleH * WINDOW_MAX_H)];
    }

    _resizeWindow() {
        if (!this._renderer)
            return;

        if (this._renderer.fullscreen)
            return;

        let maxSize = this._getMaxSize();
        let rendererSize = [this._renderer.get_preferred_width(), this._renderer.get_preferred_height()];
        let natSize = [rendererSize[0][1], rendererSize[1][1]];
        let windowSize;
        let resizePolicy = this._renderer.resizePolicy;

        if (resizePolicy == Renderer.ResizePolicy.MAX_SIZE)
            windowSize = maxSize;
        else if (resizePolicy == Renderer.ResizePolicy.NAT_SIZE)
            windowSize = natSize;
        else if (resizePolicy == Renderer.ResizePolicy.SCALED)
            windowSize = Utils.getScaledSize(natSize, maxSize, false);
        else if (resizePolicy == Renderer.ResizePolicy.STRETCHED)
            windowSize = Utils.getScaledSize(natSize, maxSize, true);

        if ((windowSize[0] > 0 && windowSize[0] != this._lastWindowSize[0]) ||
            (windowSize[1] > 0 && windowSize[1] != this._lastWindowSize[1])) {
            this._lastWindowSize = windowSize;
            this.resize(windowSize[0], windowSize[1]);
        }
    }

    _createRenderer() {
        this.file.query_info_async(
            [Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
             Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
             Gio.FILE_ATTRIBUTE_STANDARD_ICON,
             Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
             Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
             Gio.FILE_ATTRIBUTE_TIME_MODIFIED].join(','),
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
        if (this._renderer) {
            this._renderer.destroy()
            this._renderer = null;
        }

        this._renderer = renderer;
        this._renderer.show_all();
        this._renderer.expand = true;
        this._embed.add(this._renderer);

        if (this._renderer.toolbar)
            this._embed.add_overlay(this._renderer.toolbar);
    }

    _createView(fileInfo) {
        let klass = MimeHandler.getKlass(fileInfo.get_content_type());
        let renderer = new klass(this.file, fileInfo);
        this._embedRenderer(renderer);

        renderer.connect('error', (r, err) => { this._reportError(err); });
        renderer.connect('notify::fullscreen', this._onRendererFullscreen.bind(this));
        renderer.connect('notify::ready', this._onRendererReady.bind(this));
        this._onRendererReady();

        this.set_resizable(this._renderer.resizable);
        this.set_title(fileInfo.get_display_name());
    }

    _updateTitlebar() {
        try {
            let appInfo = this.file.query_default_handler(null);
            // TRANSLATORS: This is the display name of an application, e.g. "Open With Image Viewer"
            this._openButton.set_label(_("Open With %s").format(appInfo.get_display_name()));
        } catch (e) {
            // This happens when running under flatpak, since we don't have direct access
            // to the other applications
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_SUPPORTED))
                logError(e, `Failed to query default handler for ${this.file.get_uri()}`);
            this._openButton.set_label(_("Open"));
        }
    }

    _onFileOpenClicked() {
        let ctx = this.get_display().get_app_launch_context();
        ctx.set_timestamp(Gtk.get_current_event_time());
        ctx.set_screen(this.get_screen());

        // Ideally we would use gtk_show_uri_on_window() here, since it properly
        // parents dialogs that may come from a flatpak portal over the window.
        //
        // Unfortunately we need to wait until the result of the launch before
        // destroying our window, which gtk_show_uri_on_window() doesn't allow,
        // so we use GIO directly.
        Gio.AppInfo.launch_default_for_uri_async(this.file.get_uri(), ctx, null, (obj, result) => {
            try {
                Gio.AppInfo.launch_default_for_uri_finish(result);
                this.destroy();
            } catch (e) {
                logError(e, `Failed to launch default handler for ${this.file.get_uri()}`);
            }
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
        this._updateTitlebar();
        this._createRenderer();
    }
});
