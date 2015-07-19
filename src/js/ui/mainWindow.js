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

imports.gi.versions.GdkX11 = '3.0';

const Clutter = imports.gi.Clutter;
const ClutterGdk = imports.gi.ClutterGdk;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Sushi = imports.gi.Sushi;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;
const SpinnerBox = imports.ui.spinnerBox;
const Tweener = imports.ui.tweener;

var MainWindow = new Lang.Class({
    Name: 'MainWindow',

    _init : function(args) {
        args = args || {};

        this._isFullScreen = false;
        this._pendingRenderer = null;
        this._renderer = null;
        this._texture = null;
        this._toolbar = null;
        this._toolbarId = 0;
        this._fullScreenId = 0;
        this._unFullScreenId = 0;

        this._mimeHandler = new MimeHandler.MimeHandler();

        this._application = args.application;
        this._createGtkWindow();
        this._createClutterEmbed();

        this.file = null;
    },

    _createGtkWindow : function() {
        this._gtkWindow = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL,
                                           skipPagerHint: true,
                                           skipTaskbarHint: true,
                                           windowPosition: Gtk.WindowPosition.CENTER,
                                           gravity: Gdk.Gravity.CENTER,
                                           application: this._application });
        this._titlebar = new Gtk.HeaderBar({ show_close_button: true,
                                             // don't support maximize and minimize
                                             decoration_layout: 'menu:close' });
        this._gtkWindow.set_titlebar(this._titlebar);

        let screen = Gdk.Screen.get_default();
        this._gtkWindow.set_visual(screen.get_rgba_visual());

        this._gtkWindow.connect('delete-event',
                                Lang.bind(this, this._onDeleteEvent));
        this._gtkWindow.connect('key-press-event',
                                Lang.bind(this, this._onKeyPressEvent));
        this._gtkWindow.connect('motion-notify-event',
                                Lang.bind(this, this._onMotionNotifyEvent));
        this._gtkWindow.connect('realize',
                                Lang.bind(this, this._onRealize));

        this._embed = new Gtk.Overlay();
        this._gtkWindow.add(this._embed);
    },

    _createClutterEmbed : function() {
        this._clutterEmbed = new GtkClutter.Embed();
        this._embed.add(this._clutterEmbed);

        this._clutterEmbed.set_receives_default(true);
        this._clutterEmbed.set_can_default(true);

        this._stage = this._clutterEmbed.get_stage();
        this._stage.set_use_alpha(true);
        this._stage.set_opacity(0);
        this._stage.set_color(new Clutter.Color({ red: 0,
                                                  green: 0,
                                                  blue: 0,
                                                  alpha: 255 }));

        this._stage.set_layout_manager(new Clutter.BinLayout());

        this._stage.connect('button-press-event',
                            Lang.bind(this, this._onButtonPressEvent));
    },

    /**************************************************************************
     ****************** main object event callbacks ***************************
     **************************************************************************/
    _onDeleteEvent : function() {
        this._clearAndQuit();
    },

    _onRealize: function() {
        // don't support maximize and minimize
        this._gtkWindow.get_window().set_functions(Gdk.WMFunction.MOVE |
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

    _onButtonPressEvent : function(actor, event) {
        let stageWin = ClutterGdk.get_stage_window(this._stage);
        let win_coords = event.get_coords();

        if (event.get_source() == this._texture &&
            !this._renderer.moveOnClick)
            return false;

        let root_coords = stageWin.get_root_coords(win_coords[0],
                                                   win_coords[1]);

        this._gtkWindow.begin_move_drag(event.get_button(),
                                        root_coords[0],
                                        root_coords[1],
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
        let screenSize = [ this._gtkWindow.get_window().get_width(),
                           this._gtkWindow.get_window().get_height() ];

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
        let yFactor = 0;

        let textureSize = this._getTextureSize();
        let windowSize = this._getWindowSize();

        if (textureSize[0] < Constants.VIEW_MIN &&
            textureSize[1] < Constants.VIEW_MIN) {
            yFactor = 0.52;
        }

        if (yFactor == 0) {
            if (this._isFullScreen &&
               (textureSize[0] > textureSize[1]))
                yFactor = 0.52;
            else
                yFactor = 0.92;
        }

        this._texture.set_size(textureSize[0], textureSize[1]);
        this._textureYAlign.factor = yFactor;

        if (this._lastWindowSize &&
            windowSize[0] == this._lastWindowSize[0] &&
            windowSize[1] == this._lastWindowSize[1])
            return;

        this._lastWindowSize = windowSize;

        if (!this._isFullScreen) {
            this._gtkWindow.resize(windowSize[0], windowSize[1]);
        }
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
        this._renderer.startTimeout();

        file.query_info_async
        (Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME + ',' +
         Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
         Gio.FileQueryInfoFlags.NONE,
         GLib.PRIORITY_DEFAULT, null,
         Lang.bind (this,
                    function(obj, res) {
                        try {
                            this._fileInfo = obj.query_info_finish(res);
                            this.setTitle(this._fileInfo.get_display_name());

                            /* now prepare the real renderer */
                            this._pendingRenderer = this._mimeHandler.getObject(this._fileInfo.get_content_type());
                            this._pendingRenderer.prepare(file, this, Lang.bind(this, this._onRendererPrepared));
                        } catch(e) {
                            /* FIXME: report the error */
                            logError(e, 'Error calling prepare() on viewer');
                        }}));
    },

    _onRendererPrepared : function() {
        /* destroy the spinner renderer */
        this._renderer.destroy();

        this._renderer = this._pendingRenderer;
        this._pendingRenderer = null;

        /* generate the texture and toolbar for the new renderer */
        this._createTexture();
        this._createToolbar();
    },

    _createTexture : function() {
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        this._texture = this._renderer.render();
        this._textureYAlign =
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5,
                                          align_axis: Clutter.AlignAxis.Y_AXIS });
        this._texture.add_constraint(this._textureYAlign);
        this._texture.add_constraint(
            new Clutter.BindConstraint({ coordinate: Clutter.BindCoordinate.SIZE,
                                         source: this._stage }));

        this.refreshSize();
        this._stage.add_child(this._texture);
    },

    /**************************************************************************
     ************************** fullscreen ************************************
     **************************************************************************/
    _onStageUnFullScreen : function() {
        this._stage.disconnect(this._unFullScreenId);
        this._unFullScreenId = 0;

        this._textureYAlign.factor = this._savedYFactor;

        let textureSize = this._getTextureSize();
        this._texture.set_size(textureSize[0],
                               textureSize[1]);

        Tweener.addTween(this._texture,
                         { opacity: 255,
                           time: 0.15,
                           transition: 'easeOutQuad'
                         });
    },

    _exitFullScreen : function() {
        this._isFullScreen = false;
        this._removeToolbarTimeout();

        /* wait for the next stage allocation to fade in the texture
         * and background again.
         */
        this._unFullScreenId =
            this._stage.connect('notify::allocation',
                                Lang.bind(this, this._onStageUnFullScreen));

        /* quickly fade out everything,
         * and then unfullscreen the (empty) window.
         */
        Tweener.addTween(this._texture,
                         { opacity: 0,
                           time: 0.10,
                           transition: 'easeOutQuad',
                           onComplete: function() {
                               this._gtkWindow.unfullscreen();
                           },
                           onCompleteScope: this
                         });
    },

    _onStageFullScreen : function() {
        this._stage.disconnect(this._fullScreenId);
        this._fullScreenId = 0;

        /* Fade in everything */
        Tweener.addTween(this._texture,
                         { opacity: 255,
                           time: 0.15,
                           transition: 'easeOutQuad'
                         });

        /* zoom in the texture now */
        this._savedYFactor = this._textureYAlign.factor;
        let yFactor = this._savedFactor;

        if (this._texture.width > this._texture.height)
            yFactor = 0.52;
        else
            yFactor = 0.92;

        let textureSize = this._getTextureSize();

        Tweener.addTween(this._texture,
                         { width: textureSize[0],
                           height: textureSize[1],
                           time: 0.15,
                           transition: 'easeOutQuad'
                         });

        Tweener.addTween(this._textureYAlign,
                         { factor: yFactor,
                           time: 0.15,
                           transition: 'easeOutQuad'
                         });
    },

    _enterFullScreen : function() {
        this._isFullScreen = true;
        this._removeToolbarTimeout();

        /* wait for the next stage allocation to fade in the texture
         * and background again.
         */
        this._fullScreenId =
            this._stage.connect('notify::allocation',
                                Lang.bind(this, this._onStageFullScreen));

        /* quickly fade out everything,
         * and then fullscreen the (empty) window.
         */
        Tweener.addTween(this._texture,
                         { opacity: 0,
                           time: 0.10,
                           transition: 'easeOutQuad',
                           onComplete: function () {
                               this._gtkWindow.fullscreen();
                           },
                           onCompleteScope: this
                         });
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

        this._gtkWindow.destroy();
    },

    /**************************************************************************
     ************************ public methods **********************************
     **************************************************************************/
    setParent : function(xid) {
        this._parent = Sushi.create_foreign_window(xid);
        this._gtkWindow.realize();
        if (this._parent)
            this._gtkWindow.get_window().set_transient_for(this._parent);
        this._gtkWindow.show_all();

        if (this._gtkWindow.get_window().move_to_current_desktop)
          this._gtkWindow.get_window().move_to_current_desktop();
    },

    setFile : function(file) {
        this.file = file;
        this._createRenderer(file);
        this._createTexture();
        this._createToolbar();

        this._gtkWindow.show_all();
    },

    setTitle : function(label) {
        this._gtkWindow.set_title(label);
    },

    refreshSize : function() {
        this._positionTexture();
    },

    toggleFullScreen : function() {
        if (!this._renderer.canFullScreen)
            return false;

        if (this._isFullScreen) {
            this._exitFullScreen();
        } else {
            this._enterFullScreen();
        }

        return this._isFullScreen;
    },

    close : function() {
        this._clearAndQuit();
    }
});
