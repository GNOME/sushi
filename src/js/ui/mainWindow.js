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

const VIEW_MIN = 400;
const VIEW_PADDING_Y = 28;
const VIEW_PADDING_X = 4;
const VIEW_MAX_W = 800;
const VIEW_MAX_H = 600;

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
                                           skipTaskbarHint: true});

        let screen = Gdk.Screen.get_default();
        this._gtkWindow.set_visual(screen.get_rgba_visual());

        this._gtkWindow.connect("delete-event",
                                Lang.bind(this, this._onWindowDeleteEvent));
        this._gtkWindow.connect("configure-event",
                                Lang.bind(this, this._onWindowConfigureEvent));
    },

    _createClutterEmbed : function() {
        this._clutterEmbed = new GtkClutter.Embed();
        this._gtkWindow.add(this._clutterEmbed);

        this._clutterEmbed.set_receives_default(true);
        this._clutterEmbed.set_can_default(true);

        this._stage = this._clutterEmbed.get_stage();
        this._stage.set_use_alpha(true);
        this._stage.set_opacity(221);
        this._stage.set_color(new Clutter.Color({ red: 0,
                                                  green: 0,
                                                  blue: 0, 
                                                  alpha: 255 }));
        this._stage.set_size(VIEW_MIN, VIEW_MIN);
        this._gtkWindow.resize(VIEW_MIN, VIEW_MIN);
    },

    _connectStageSignals : function() {
        this._stage.connect("key-press-event",
                            Lang.bind(this, this._onStageKeyPressEvent));
        this._stage.connect("button-press-event",
                            Lang.bind(this, this._onButtonPressEvent));
        this._stage.connect("motion-event",
                            Lang.bind(this, this._onMotionEvent));
    },

    _onWindowDeleteEvent : function() {
        this._application.quit();
    },

    _onWindowConfigureEvent : function() {
        if (this._renderer)
            this.refreshSize();
    },

    _onStageKeyPressEvent : function(actor, event) {
        let key = event.get_key_symbol();

        if (key == Clutter.Escape)
            this._application.quit();
    },

    toggleFullScreen : function() {
        /* FIXME: this doesn't work well, but I don't really understand why...*/
        if(this._isFullScreen) {
            this._isFullScreen = false;
            this._gtkWindow.unmaximize();
        } else {
            this._isFullScreen = true;
            this._gtkWindow.maximize();
        }

        this.refreshSize();
    },

    _positionTexture : function() {
        let yFactor = 0;
        let screenSize = [ this._gtkWindow.get_window().get_width(),
                            this._gtkWindow.get_window().get_height() ];

        let availableWidth = this._isFullScreen ? screenSize[0] : VIEW_MAX_W;
        let availableHeight = this._isFullScreen ? screenSize[1] - VIEW_PADDING_Y : VIEW_MAX_H;

        let textureSize = this._renderer.getSizeForAllocation([availableWidth, availableHeight]);
        this._texture.set_size(textureSize[0], textureSize[1]);

        let windowSize = textureSize;
            
        if (textureSize[0] < VIEW_MIN &&
            textureSize[1] < VIEW_MIN) {
            windowSize = [ VIEW_MIN, VIEW_MIN ];
            yFactor = 0.52;
        }

        if (!this._isFullScreen) {
            this._gtkWindow.resize(windowSize[0] + VIEW_PADDING_X, windowSize[1] + VIEW_PADDING_Y);
        }

        this._texture.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        if (yFactor == 0) {
                yFactor = 0.92;
        }

        let yAlign =                 
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: yFactor })
        yAlign.set_align_axis(Clutter.AlignAxis.Y_AXIS);
        this._texture.add_constraint(yAlign);
    },

    setParent : function(xid) {
        let parent = GdkX11.X11Window.foreign_new_for_display(this._gtkWindow.get_display(),
                                                              xid);
        this._gtkWindow.get_window().set_transient_for(parent);
    },

    showAll : function() {
        this._gtkWindow.show_all();
    },

    setFile : function(file) {
        if (this._texture)
            this._texture.destroy();

        let info = file.query_info("standard::content-type",
                                   0, null);
        this._renderer = this._mimeHandler.getObject(info.get_content_type());

        this._texture = this._renderer.render(file, this);

        this.refreshSize();
        this._stage.add_actor(this._texture);

        this._toolbarActor = this._renderer.createToolbar();
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

        this._createTitle(file);
    },

    refreshSize : function() {
        this._positionTexture();
    },

    _createTitle : function(file) {
        if (this._titleLabel) {
            this._titleLabel.set_label(file.get_basename());
            return;
        }

        this._titleLabel = new Gtk.Label({ label: file.get_basename() });
        this._titleLabel.get_style_context().add_class("np-decoration");
        
        this._titleLabel.show();
        let actor = new GtkClutter.Actor({ contents: this._titleLabel });
        actor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));
        actor.add_constraint(
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: 3 }));

        this._stage.add_actor(actor);

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

        this._stage.add_actor(this._quitActor);
    },

    _createGrip : function() {
        /* TODO */
    },

    _onButtonPressEvent : function(actor, event) {        
        let win_coords = event.get_coords();

        if ((event.get_source() == this._toolbarActor) ||
            (event.get_source() == this._quitActor)) {

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

    _resetToolbar : function() {
        if (this._toolbarId) {
            GLib.source_remove(this._toolbarId);
            delete this._toolbarId;
        } else {
            Tweener.removeAllTweens(this._toolbarActor);

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

    _onMotionEvent : function() {
        if (this._toolbarActor)
            this._resetToolbar();

        return true;
    },

    _onToolbarTimeout : function() {
        delete this._toolbarId;
        Tweener.addTween(this._toolbarActor,
                         { opacity: 0,
                           time: 0.25,
                           transition: 'easeOutQuad'
                         });
        return false;
    }
}