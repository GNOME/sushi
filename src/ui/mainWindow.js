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

const Mainloop = imports.mainloop;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;
const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

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

var MainWindow = GObject.registerClass(class MainWindow extends Gtk.Window {
    _init(application) {
        this._renderer = null;
        this._lastWindowSize = [0, 0];
        this._toolbar = null;
        this._toolbarId = 0;
        this.file = null;

        super._init({ type: Gtk.WindowType.TOPLEVEL,
                      skipPagerHint: true,
                      skipTaskbarHint: true,
                      windowPosition: Gtk.WindowPosition.CENTER,
                      gravity: Gdk.Gravity.CENTER,
                      application: application });

        this._titlebar = new Gtk.HeaderBar({ show_close_button: true,
                                             // don't support maximize and minimize
                                             decoration_layout: 'menu:close' });
        this.set_titlebar(this._titlebar);

        this._openButton = new Gtk.Button();
        this._openButton.connect('clicked', this._onFileOpenClicked.bind(this));
        this._titlebar.pack_end(this._openButton);

        this.connect('destroy', this._onDestroy.bind(this));
        this.connect('key-press-event', this._onKeyPressEvent.bind(this));
        this.connect('motion-notify-event', this._onMotionNotifyEvent.bind(this));
        this.connect('realize', this._onRealize.bind(this));

        let eventBox = new Gtk.EventBox({ visible_window: false });
        eventBox.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this.add(eventBox);

        this._embed = new Embed();
        eventBox.add(this._embed);
    }

    /**************************************************************************
     ****************** main object event callbacks ***************************
     **************************************************************************/
    _onDestroy() {
        this._removeToolbarTimeout();
    }

    _onRealize() {
        // don't support maximize and minimize
        this.get_window().set_functions(Gdk.WMFunction.MOVE |
                                        Gdk.WMFunction.RESIZE |
                                        Gdk.WMFunction.CLOSE);
    }

    _onKeyPressEvent(widget, event) {
        let key = event.get_keyval()[1];

        if (key == Gdk.KEY_Escape ||
            key == Gdk.KEY_space ||
            key == Gdk.KEY_q)
            this.destroy();

        if (key == Gdk.KEY_f ||
            key == Gdk.KEY_F11)
            this._renderer.toggleFullscreen();

        return false;
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
        if (this._toolbar)
            this._resetToolbar();

        return false;
    }

    /**************************************************************************
     *********************** texture allocation *******************************
     **************************************************************************/
    _onRendererFullscreen() {
        this._removeToolbarTimeout();

        if (this._renderer.fullscreen)
            this.fullscreen();
        else
            this.unfullscreen();
    }

    _onRendererReady() {
        if (this._renderer.ready) {
            this._resizeWindow();
            this.queue_resize();
        }

        if (!this.visible)
            this.show_all();
    }

    _resizeWindow() {
        if (!this._renderer)
            return;

        if (this._renderer.fullscreen)
            return;

        let maxSize = [Constants.VIEW_MAX_W, Constants.VIEW_MAX_H];
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
            [Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
             Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE].join(','),
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null,
            (obj, res) => {
                try {
                    let fileInfo = obj.query_info_finish(res);
                    this._createView(fileInfo);
                    this._createToolbar();
                } catch(e) {
                    /* FIXME: report the error */
                    logError(e, 'Error creating viewer');
                }
            });
    }

    _createView(fileInfo) {
        if (this._renderer) {
            this._renderer.destroy()
            this._renderer = null;
        }

        let klass = MimeHandler.getKlass(fileInfo.get_content_type());
        this._renderer = new klass(this.file, fileInfo);
        this._renderer.show_all();
        this._renderer.expand = true;
        this._embed.add(this._renderer);

        this._renderer.connect('notify::fullscreen', this._onRendererFullscreen.bind(this));
        this._renderer.connect('notify::ready', this._onRendererReady.bind(this));
        this._onRendererReady();

        this.set_resizable(this._renderer.resizable);
        this.set_title(fileInfo.get_display_name());
    }

    /**************************************************************************
     ************************* toolbar helpers ********************************
     **************************************************************************/
    _createToolbar() {
        this._removeToolbarTimeout();

        if (this._toolbar) {
            this._toolbar.destroy();
            this._toolbar = null;
        }

        if (this._renderer.populateToolbar) {
            this._toolbar = new Gtk.Revealer({ valign: Gtk.Align.END,
                                               hexpand: true,
                                               margin_bottom: Constants.TOOLBAR_SPACING,
                                               margin_start: Constants.TOOLBAR_SPACING,
                                               margin_end: Constants.TOOLBAR_SPACING,
                                               transition_duration: 250,
                                               transition_type: Gtk.RevealerTransitionType.CROSSFADE,
                                               visible: true });

            let rendererToolbar = new Renderer.RendererToolbar();
            this._toolbar.add(rendererToolbar);

            this._renderer.populateToolbar(rendererToolbar);
            this._toolbar.show_all();
        }

        if (!this._toolbar)
            return;

        this._embed.add_overlay(this._toolbar);
    }

    _removeToolbarTimeout() {
        if (this._toolbarId != 0) {
            Mainloop.source_remove(this._toolbarId);
            this._toolbarId = 0;
        }
    }

    _resetToolbar() {
        if (this._toolbarId == 0)
            this._toolbar.reveal_child = true;

        this._removeToolbarTimeout();
        this._toolbarId = Mainloop.timeout_add(1500, this._onToolbarTimeout.bind(this));
    }

    _onToolbarTimeout() {
        this._toolbarId = 0;
        this._toolbar.reveal_child = false;
        return false;
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
    setParent(xid) {
        this._parent = Sushi.create_foreign_window(xid);
        this.realize();
        if (this._parent)
            this.get_window().set_transient_for(this._parent);

        if (this.get_window().move_to_current_desktop)
            this.get_window().move_to_current_desktop();
    }

    setFile(file) {
        this.file = file;
        this._updateTitlebar();
        this._createRenderer();
    }
});
