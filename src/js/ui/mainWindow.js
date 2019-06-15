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

const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Sushi = imports.gi.Sushi;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;

var MainWindow = new Lang.Class({
    Name: 'MainWindow',
    Extends: Gtk.Window,

    _init : function(application) {
        this._isFullScreen = false;
        this._renderer = null;
        this._view = null;
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

        this.connect('delete-event',
                     Lang.bind(this, this._onDeleteEvent));
        this.connect('key-press-event',
                     Lang.bind(this, this._onKeyPressEvent));
        this.connect('motion-notify-event',
                     Lang.bind(this, this._onMotionNotifyEvent));
        this.connect('realize',
                     Lang.bind(this, this._onRealize));

        let eventBox = new Gtk.EventBox({ visible_window: false });
        eventBox.connect('button-press-event',
                         Lang.bind(this, this._onButtonPressEvent));
        this.add(eventBox);

        this._embed = new Gtk.Overlay();
        eventBox.add(this._embed);
    },

    /**************************************************************************
     ****************** main object event callbacks ***************************
     **************************************************************************/
    _onDeleteEvent : function() {
        this._clearAndQuit();
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
            this._clearAndQuit();

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
    _getTextureSize : function() {
        let screenSize = [ this.get_window().get_width(),
                           this.get_window().get_height() ];

        let availableWidth = this._isFullScreen ? screenSize[0] : Constants.VIEW_MAX_W - 2 * Constants.VIEW_PADDING_X;
        let availableHeight = this._isFullScreen ? screenSize[1] : Constants.VIEW_MAX_H - Constants.VIEW_PADDING_Y;

        let textureSize = this._renderer.getSizeForAllocation([availableWidth, availableHeight], this._isFullScreen);

        return textureSize;
    },

    _getWindowSize : function() {
        let textureSize = this._getTextureSize();
        let windowSize = textureSize;

        if (textureSize[0] < (Constants.VIEW_MIN - 2 * Constants.VIEW_PADDING_X) &&
            textureSize[1] < (Constants.VIEW_MIN - Constants.VIEW_PADDING_Y)) {
            windowSize = [ Constants.VIEW_MIN, Constants.VIEW_MIN ];
        } else if (!this._isFullScreen) {
            windowSize = [ windowSize[0] + 2 * Constants.VIEW_PADDING_X,
                           windowSize[1] + Constants.VIEW_PADDING_Y ];
        }

        return windowSize;
    },

    _positionTexture : function() {
        let windowSize = this._getWindowSize();

        if (this._lastWindowSize &&
            windowSize[0] == this._lastWindowSize[0] &&
            windowSize[1] == this._lastWindowSize[1])
            return;

        this._lastWindowSize = windowSize;

        if (!this._isFullScreen)
            this.resize(windowSize[0], windowSize[1]);
    },

    _createRenderer : function(file) {
        if (this._renderer) {
            if (this._renderer.clear)
                this._renderer.clear();

            this._renderer = null;
        }

        /* create a temporary spinner renderer, that will timeout and show itself
         * if the loading takes too long.
         */
        this._renderer = new SpinnerBox.SpinnerBox();

        file.query_info_async
        (Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME + ',' +
         Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
         Gio.FileQueryInfoFlags.NONE,
         GLib.PRIORITY_DEFAULT, null,
         Lang.bind (this, function(obj, res) {
             try {
                 this._fileInfo = obj.query_info_finish(res);
                 this.setTitle(this._fileInfo.get_display_name());

                 /* now prepare the real renderer */
                 this._renderer = this._mimeHandler.getObject(this._fileInfo.get_content_type());
                 this._createView(file);
                 this._createToolbar();
             } catch(e) {
                 /* FIXME: report the error */
                 logError(e, 'Error calling prepare() on viewer');
             }})
        );
    },

    _createView : function(file) {
        if (this._view) {
            this._view.destroy();
            this._view = null;
        }

        this._view = this._renderer.render(file, this);
        this._view.expand = true;
        this._view.show();

        this._embed.add(this._view);
        this.refreshSize();
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
            let rendererToolbar = new Gtk.Toolbar({ icon_size: Gtk.IconSize.MENU,
                                                    halign: Gtk.Align.CENTER,
                                                    show_arrow: false,
                                                    visible: true });
            rendererToolbar.get_style_context().add_class('osd');

            this._toolbar = new Gtk.Revealer({ valign: Gtk.Align.END,
                                               hexpand: true,
                                               margin_bottom: Constants.TOOLBAR_SPACING,
                                               margin_start: Constants.TOOLBAR_SPACING,
                                               margin_end: Constants.TOOLBAR_SPACING,
                                               transition_duration: 250,
                                               transition_type: Gtk.RevealerTransitionType.CROSSFADE,
                                               visible: true });
            this._toolbar.add(rendererToolbar);

            this._renderer.populateToolbar(rendererToolbar);
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
        this._toolbarId = Mainloop.timeout_add(1500,
                                               Lang.bind(this,
                                                         this._onToolbarTimeout));
    },

    _onToolbarTimeout : function() {
        this._toolbarId = 0;
        this._toolbar.reveal_child = false;
        return false;
    },

    /**************************************************************************
     *********************** Window move/fade helpers *************************
     **************************************************************************/
    _clearAndQuit : function() {
        if (this._renderer.clear)
            this._renderer.clear();

        this.destroy();
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
        this._createView();
        this._createToolbar();

        this.show_all();
    },

    setTitle : function(label) {
        this.set_title(label);
    },

    refreshSize : function() {
        this._positionTexture();
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
    },

    close : function() {
        this._clearAndQuit();
    }
});
