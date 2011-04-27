const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Clutter = imports.gi.Clutter;

const Cairo = imports.cairo;
const Tweener = imports.tweener.tweener;
const Lang = imports.lang;

const Mainloop = imports.mainloop;

const MimeHandler = imports.ui.mimeHandler;
const Constants = imports.util.constants;

const Sushi = imports.gi.Sushi;

function MainWindow(args) {
    this._init(args);
}

MainWindow.prototype = {
    _init : function(args) {
        args = args || {};

        this._mimeHandler = new MimeHandler.MimeHandler();

        this._application = args.application;
        this._createGtkWindow();
        this._createClutterEmbed();

        this._connectStageSignals();
    },

    _createGtkWindow : function() {
        this._gtkWindow = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL,
                                           focusOnMap: true,
                                           decorated: false,
                                           hasResizeGrip: false,
                                           skipPagerHint: true,
                                           skipTaskbarHint: true });

        let screen = Gdk.Screen.get_default();
        this._gtkWindow.set_visual(screen.get_rgba_visual());

        this._gtkWindow.connect("delete-event",
                                Lang.bind(this, this._onWindowDeleteEvent));
    },

    _createClutterEmbed : function() {
        this._clutterEmbed = new GtkClutter.Embed();
        this._gtkWindow.add(this._clutterEmbed);

        this._clutterEmbed.set_receives_default(true);
        this._clutterEmbed.set_can_default(true);

        this._stage = this._clutterEmbed.get_stage();
        this._stage.set_use_alpha(true);
        this._stage.set_opacity(0);
        this._stage.set_color(new Clutter.Color({ red: 0,
                                                  green: 0,
                                                  blue: 0,
                                                  alpha: 255 }));
    },

    _connectStageSignals : function() {
        this._stage.connect("key-press-event",
                            Lang.bind(this, this._onStageKeyPressEvent));
        this._stage.connect("button-press-event",
                            Lang.bind(this, this._onButtonPressEvent));
        this._stage.connect("motion-event",
                            Lang.bind(this, this._onMotionEvent));
    },

    _createAlphaBackground: function() {
        if (this._background)
            return;

        this._background = Sushi.create_rounded_background();
        this._background.add_constraint(
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.POSITION }));
        this._background.add_constraint(
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.SIZE }));

        this._stage.add_actor(this._background);
        this._background.lower_bottom();
    },

    /**************************************************************************
     ****************** main object event callbacks ***************************
     **************************************************************************/
    _onWindowDeleteEvent : function() {
        this._application.quit();
    },

    _onStageKeyPressEvent : function(actor, event) {
        let key = event.get_key_symbol();

        if (key == Clutter.KEY_Escape ||
            key == Clutter.KEY_space)
            this._fadeOutWindow();
    },

    _onButtonPressEvent : function(actor, event) {
        let win_coords = event.get_coords();

        if ((event.get_source() == this._toolbarActor) ||
            (event.get_source() == this._quitActor) ||
            (event.get_source() == this._texture &&
             !this._renderer.moveOnClick)) {

            if (event.get_source() == this._toolbarActor)
                this._resetToolbar();

            return false;
        }

        let root_coords = 
            this._gtkWindow.get_window().get_root_coords(win_coords[0],
                                                         win_coords[1]);

        this._gtkWindow.begin_move_drag(event.get_button(),
                                        root_coords[0],
                                        root_coords[1],
                                        event.get_time());

        return false;
    },

    _onMotionEvent : function() {
        if (this._toolbarActor)
            this._resetToolbar();

        return false;
    },

    /**************************************************************************
     *********************** texture allocation *******************************
     **************************************************************************/
    _getTextureSize : function() {
        let screenSize = [ this._gtkWindow.get_window().get_width(),
                           this._gtkWindow.get_window().get_height() ];

        let availableWidth = this._isFullScreen ? screenSize[0] : Constants.VIEW_MAX_W;
        let availableHeight = this._isFullScreen ? screenSize[1] - Constants.VIEW_PADDING_Y : Constants.VIEW_MAX_H;

        let textureSize = this._renderer.getSizeForAllocation([availableWidth, availableHeight], this._isFullScreen);

        return textureSize;
    },

    _getWindowSize : function() {
        let textureSize = this._getTextureSize();
        let windowSize = textureSize;

        if (textureSize[0] < Constants.VIEW_MIN &&
            textureSize[1] < Constants.VIEW_MIN) {
            windowSize = [ Constants.VIEW_MIN, Constants.VIEW_MIN ];
        }

        if (!this._isFullScreen) {
            windowSize = [ windowSize[0] + Constants.VIEW_PADDING_X,
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

            delete this._renderer;
        }

        let info = file.query_info("standard::content-type",
                                   0, null);
        this._renderer = this._mimeHandler.getObject(info.get_content_type());        
    },

    _createTexture : function(file) {
        if (this._texture) {
            this._texture.destroy();
            delete this._texture;
        }

        this._texture = this._renderer.render(file, this);

        this._textureXAlign = 
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 });
        this._textureYAlign =
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5,
                                          "align-axis": Clutter.AlignAxis.Y_AXIS })

        this._texture.add_constraint(this._textureXAlign);
        this._texture.add_constraint(this._textureYAlign);

        this.refreshSize();
        this._stage.add_actor(this._texture);
    },

    /**************************************************************************
     ************************** fullscreen ************************************
     **************************************************************************/
    _onStageUnFullScreen : function() {
        this._stage.disconnect(this._unFullScreenId);
        delete this._unFullScreenId;

        this._createAlphaBackground();
        this._background.set_opacity(Constants.VIEW_BACKGROUND_OPACITY);
        this._textureYAlign.factor = this._savedYFactor;

        let textureSize = this._getTextureSize();
        this._texture.set_size(textureSize[0],
                               textureSize[1]);

        Tweener.addTween(this._texture,
                         { opacity: 255,
                           time: 0.15,
                           transition: 'easeOutQuad',
                         });
    },

    _exitFullScreen : function() {
        this._isFullScreen = false;

        this._toolbarActor.set_opacity(0);
        this._removeToolbarTimeout();

        /* wait for the next stage allocation to fade in the texture 
         * and background again.
         */
        this._unFullScreenId =
            this._stage.connect("notify::allocation",
                                Lang.bind(this, this._onStageUnFullScreen));

        /* quickly fade out background and texture,
         * and then unfullscreen the (empty) window.
         */
        Tweener.addTween(this._stage,
                         { opacity: 0,
                           time: 0.10,
                           transition: 'easeOutQuad'
                         });

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
        delete this._fullScreenId;

        /* fade in the solid black background */
        Tweener.addTween(this._stage,
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
                         { opacity: 255,
                           width: textureSize[0],
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

        /* prepare the toolbar */
        this._toolbarActor.set_opacity(0);
        this._removeToolbarTimeout();

        /* wait for the next stage allocation to fade in the texture 
         * and background again.
         */
        this._fullScreenId =
            this._stage.connect("notify::allocation",
                                Lang.bind(this, this._onStageFullScreen));

        /* quickly fade out background and texture,
         * and then fullscreen the (empty) window.
         */
        Tweener.addTween(this._background,
                         { opacity: 0,
                           time: 0.10,
                           transition: 'easeOutQuad',
                           onComplete: function () {
                               this._background.destroy();
                               delete this._background;
                           },
                           onCompleteScope: this
                         });

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
        if (this._toolbarActor) {
            this._toolbarActor.destroy();
            delete this._toolbarActor;
        }

        this._toolbarActor = this._renderer.createToolbar();

        if (!this._toolbarActor)
            return;

        this._toolbarActor.set_reactive(true);
        this._stage.add_actor(this._toolbarActor);

        this._toolbarActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        let yConstraint = 
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: this._stage.height - 52 });
        this._toolbarActor.add_constraint(yConstraint);

        this._stage.connect("notify::height",
                            Lang.bind(this, function() {
                                yConstraint.set_offset(this._stage.height - 52);
                            }));
    },

    _removeToolbarTimeout: function() {
        Mainloop.source_remove(this._toolbarId);
        delete this._toolbarId;
    },

    _resetToolbar : function() {
        if (this._toolbarId) {
            this._removeToolbarTimeout();
        } else {
            Tweener.removeTweens(this._toolbarActor);

            this._toolbarActor.raise_top();
            this._toolbarActor.set_opacity(0);

            Tweener.addTween(this._toolbarActor,
                             { opacity: 200,
                               time: 0.1,
                               transition: 'easeOutQuad',
                             });
        }

        this._toolbarId = Mainloop.timeout_add(1500,
                                               Lang.bind(this,
                                                         this._onToolbarTimeout));
    },

    _onToolbarTimeout : function() {
        delete this._toolbarId;
        Tweener.addTween(this._toolbarActor,
                         { opacity: 0,
                           time: 0.25,
                           transition: 'easeOutQuad'
                         });
        return false;
    },

    /**************************************************************************
     ************************ titlebar helpers ********************************
     **************************************************************************/
    _createTitle : function(file) {
        if (this._titleLabel) {
            this._titleLabel.set_label(file.get_basename());
            this._titleActor.raise_top();
            this._quitActor.raise_top();
            return;
        }

        this._titleLabel = new Gtk.Label({ label: file.get_basename() });
        this._titleLabel.get_style_context().add_class("np-decoration");
        
        this._titleLabel.show();
        this._titleActor = new GtkClutter.Actor({ contents: this._titleLabel });
        this._titleActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));
        this._titleActor.add_constraint(
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: 3 }));

        this._quitButton = 
            new Gtk.Button({ image: new Gtk.Image ({ "icon-size": Gtk.IconSize.MENU,
                                                     "icon-name": "window-close-symbolic" })});
        this._quitButton.get_style_context().add_class("np-decoration");
        this._quitButton.show();

        this._quitButton.connect("clicked",
                                 Lang.bind(this._application,
                                           this._application.quit));

        this._quitActor = new GtkClutter.Actor({ contents: this._quitButton });
        this._quitActor.set_reactive(true);
        this._quitActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 1.0 }));

        this._stage.add_actor(this._titleActor);
        this._stage.add_actor(this._quitActor);
    },

    /**************************************************************************
     *********************** Window move/fade helpers *************************
     **************************************************************************/
    _moveWindow : function() {
        let screen = this._gtkWindow.get_screen();
        let monitor = screen.get_monitor_at_window(this._parent);
        let geometry = screen.get_monitor_geometry(monitor);
        let windowSize = this._getWindowSize();

        this._gtkWindow.resize(windowSize[0], windowSize[1]);
        this._gtkWindow.move((geometry.width - windowSize[0]) / 2,
                             (geometry.height - windowSize[1]) / 2);
    },

    _fadeInWindow : function() {
        this._background.set_opacity(0);
        this._texture.set_opacity(0);

        this._gtkWindow.show_all();

        Tweener.addTween(this._background,
                         { opacity: Constants.VIEW_BACKGROUND_OPACITY,
                           time: 0.3,
                           transition: 'easeOutQuad' });
        Tweener.addTween(this._texture,
                         { opacity: 255,
                           time: 0.3,
                           transition: 'easeOutQuad' });
    },

    _fadeOutWindow : function() {
        Tweener.addTween(this._background,
                         { opacity: 0,
                           time: 0.15,
                           transition: 'easeOutQuad' });
        Tweener.addTween(this._texture,
                         { opacity: 0,
                           time: 0.15,
                           transition: 'easeOutQuad',
                           onComplete: function () {
                               this._application.quit();
                           },
                           onCompleteScope: this
                         });
    },

    /**************************************************************************
     ************************ public methods **********************************
     **************************************************************************/
    setParent : function(xid) {
        this._parent = Sushi.create_foreign_window(xid);

        if (!this._gtkWindow.get_realized()) {
            this._gtkWindow.realize();
            this._gtkWindow.get_window().set_transient_for(this._parent);

            /* FIXME: I don't know why I need to call this before
             * drawing the background.
             */
            this._gtkWindow.show_all();
            this._gtkWindow.hide();
        }
    },

    setFile : function(file) {
        this._createAlphaBackground();
        this._createRenderer(file);
        this._createTexture(file);
        this._createToolbar();
        this._createTitle(file);

        if (!this._gtkWindow.get_visible()) {
            this._moveWindow();
            this._fadeInWindow();
        }
    },

    setTitle : function(label) {
        this._titleLabel.set_label(label);
    },

    refreshSize : function() {
        this._positionTexture();
    },

    toggleFullScreen : function() {
        if (this._isFullScreen) {
            this._exitFullScreen();
        } else {
            this._enterFullScreen();
        }
    }
}
