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

const {Gdk, Gio, GLib, Gtk, Sushi} = imports.gi;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;
const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

const Embed = new Lang.Class({
    Name: 'Embed',
    Extends: Gtk.Overlay,
    Signals: { 'size-request': {} },

    vfunc_get_request_mode: function() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    },

    vfunc_get_preferred_width: function() {
        let [min, nat] = this.parent();

        min = Math.max(min, Constants.VIEW_MIN);
        nat = Math.max(nat, Constants.VIEW_MIN);

        // FIXME: this is wrong, we should only be doing this
        // when the renderer signals us to do so
        this.emit('size-request');

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

var MainWindow = new Lang.Class({
    Name: 'MainWindow',
    Extends: Gtk.Window,

    _init : function(application) {
        this._isFullScreen = false;
        this._renderer = null;
        this._lastWindowSize = [0, 0];
        this._toolbar = null;
        this._toolbarId = 0;
        this.file = null;

        this._mimeHandler = new MimeHandler.MimeHandler();

        this.parent({ type: Gtk.WindowType.TOPLEVEL,
                      skipPagerHint: true,
                      skipTaskbarHint: true,
                      windowPosition: Gtk.WindowPosition.CENTER,
                      gravity: Gdk.Gravity.CENTER,
                      application: application });

        this._titlebar = new Gtk.HeaderBar({ show_close_button: true,
                                             // don't support maximize and minimize
                                             decoration_layout: 'menu:close' });
        this.set_titlebar(this._titlebar);

        this.connect('delete-event', this._onDeleteEvent.bind(this));
        this.connect('key-press-event', this._onKeyPressEvent.bind(this));
        this.connect('motion-notify-event', this._onMotionNotifyEvent.bind(this));
        this.connect('realize', this._onRealize.bind(this));

        let eventBox = new Gtk.EventBox({ visible_window: false });
        eventBox.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this.add(eventBox);

        this._embed = new Embed();
        this._embed.connect('size-request', this._onEmbedSizeRequest.bind(this));
        eventBox.add(this._embed);
    },

    /**************************************************************************
     ****************** main object event callbacks ***************************
     **************************************************************************/
    _onDeleteEvent : function() {
        this.destroy();
    },

    _onRealize: function() {
        // don't support maximize and minimize
        this.get_window().set_functions(Gdk.WMFunction.MOVE |
                                        Gdk.WMFunction.RESIZE |
                                        Gdk.WMFunction.CLOSE);
    },

    _onKeyPressEvent : function(widget, event) {
        let key = event.get_keyval()[1];

        if (key == Gdk.KEY_Escape ||
            key == Gdk.KEY_space ||
            key == Gdk.KEY_q)
            this.destroy();

        if (key == Gdk.KEY_f ||
            key == Gdk.KEY_F11)
            this.toggleFullScreen();

        return false;
    },

    _onButtonPressEvent : function(window, event) {
        if (!this._renderer.moveOnClick)
            return false;

        let [, rootX, rootY] = event.get_root_coords();
        let [, button] = event.get_button();
        this.begin_move_drag(button,
                             rootX, rootY,
                             event.get_time());

        return false;
    },

    _onMotionNotifyEvent : function() {
        if (this._toolbar)
            this._resetToolbar();

        return false;
    },

    /**************************************************************************
     *********************** texture allocation *******************************
     **************************************************************************/
    _onEmbedSizeRequest : function() {
        this._resizeWindow();
    },

    _resizeWindow : function() {
        if (this._isFullScreen)
            return;

        if (!this._renderer)
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
    },

    _createRenderer : function(file) {
        file.query_info_async(
            [Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
             Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE].join(','),
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null,
            (obj, res) => {
                try {
                    this._fileInfo = obj.query_info_finish(res);
                    this.setTitle(this._fileInfo.get_display_name());

                    /* now prepare the real renderer */
                    let klass = this._mimeHandler.getKlass(this._fileInfo.get_content_type());
                    this._createView(file, klass);
                    this._createToolbar();
                } catch(e) {
                    /* FIXME: report the error */
                    logError(e, 'Error creating viewer');
                }
            });
    },

    _createView : function (file, klass) {
        if (this._renderer) {
            this._renderer.destroy()
            this._renderer = null;
        }

        this._renderer = new klass(file, this);
        this._renderer.show_all();
        this._renderer.expand = true;
        this._embed.add(this._renderer);
    },

    /**************************************************************************
     ************************* toolbar helpers ********************************
     **************************************************************************/
    _createToolbar : function() {
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
    },

    _removeToolbarTimeout: function() {
        if (this._toolbarId != 0) {
            Mainloop.source_remove(this._toolbarId);
            this._toolbarId = 0;
        }
    },

    _resetToolbar : function() {
        if (this._toolbarId == 0)
            this._toolbar.reveal_child = true;

        this._removeToolbarTimeout();
        this._toolbarId = Mainloop.timeout_add(1500, this._onToolbarTimeout.bind(this));
    },

    _onToolbarTimeout : function() {
        this._toolbarId = 0;
        this._toolbar.reveal_child = false;
        return false;
    },

    /**************************************************************************
     ************************ public methods **********************************
     **************************************************************************/
    setParent : function(xid) {
        this._parent = Sushi.create_foreign_window(xid);
        this.realize();
        if (this._parent)
            this.get_window().set_transient_for(this._parent);
        this.show_all();

        if (this.get_window().move_to_current_desktop)
          this.get_window().move_to_current_desktop();
    },

    setFile : function(file) {
        this.file = file;
        this._createRenderer(file);
    },

    setTitle : function(label) {
        this.set_title(label);
    },

    toggleFullScreen : function() {
        if (!this._renderer.canFullScreen)
            return false;

        this._removeToolbarTimeout();

        if (this._isFullScreen) {
            this._isFullScreen = false;
            this.unfullscreen();
        } else {
            this._isFullScreen = true;
            this.fullscreen();
        }

        return this._isFullScreen;
    }
});
