const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Clutter = imports.gi.Clutter;

const Cairo = imports.cairo;
const Lang = imports.lang;

const Mainloop = imports.mainloop;

function MainWindow(args) {
    this._init(args);
}

MainWindow.prototype = {
    _init : function(args) {
        args = args || {};

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
        this._stage.set_size(400, 400);
        this._gtkWindow.resize(400, 400);
    },

    _connectStageSignals : function() {
        this._stage.connect("key-press-event",
                            Lang.bind(this, this._onStageKeyPressEvent));
    },

    _createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });
        this._toolbarActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        let yConstraint = 
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: this._stage.height - 52 });
        this._toolbarActor.add_constraint(yConstraint);

        this._toolbarActor.set_size(100, 40);
        this._toolbarActor.set_opacity(200);
        this._stage.add_actor(this._toolbarActor);

        this._stage.connect("notify::height",
                            Lang.bind(this, function() {
                                yConstraint.set_offset(this._stage.height - 52);
                            }));

        this._toolbarNext = new Gtk.ToolButton();
        this._toolbarNext.set_icon_name("go-next-symbolic");
        this._toolbarNext.show();
        this._toolbarNext.set_expand(true);
        this._mainToolbar.insert(this._toolbarNext, 0);

        this._toolbarZoom = new Gtk.ToolButton();
        this._toolbarZoom.set_icon_name("view-fullscreen-symbolic");
        this._toolbarZoom.set_expand(true);
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 0);

        this._toolbarPrev = new Gtk.ToolButton();
        this._toolbarPrev.set_icon_name("go-previous-symbolic");
        this._toolbarPrev.set_expand(true);
        this._toolbarPrev.show();
        this._mainToolbar.insert(this._toolbarPrev, 0);
    },

    _onWindowDeleteEvent : function() {
        this._application.quit();
    },

    _onStageKeyPressEvent : function(actor, event) {
        let key = event.get_key_symbol();

        if (key == Clutter.Escape)
            this._application.quit();
    },

    showAll : function() {
        this._gtkWindow.show_all();
    },

    setFile : function(file) {
        if (this._texture)
            this._texture.destroy();

        this._texture = new Clutter.Texture({ filename: file.get_path(),
                                             "keep-aspect-ratio": true });

        if(this._texture.width > 800 || this._texture.height > 600) {
            let scale = 0;

            if (this._texture.width > this._texture.height)
                scale = 800 / this._texture.width;
            else
                scale = 600 / this._texture.height;

            this._texture.set_size(this._texture.width * scale,
                                   this._texture.height * scale);
            this._gtkWindow.resize(this._texture.width,
                                   this._texture.height);
        } else if (this._texture.width < 400 ||
                   this._texture.height < 400) {
            this._texture.add_constraint(
                new Clutter.AlignConstraint({ source: this._stage,
                                              factor: 0.5 }));

            let yAlign =                 
                new Clutter.AlignConstraint({ source: this._stage,
                                              factor: 0.5 })
            yAlign.set_align_axis(Clutter.AlignAxis.Y_AXIS);
            this._texture.add_constraint(yAlign);

            this._gtkWindow.resize(400, 400);
        } else {
            this._gtkWindow.resize(this._texture.width,
                                   this._texture.height);
        }

        this._stage.add_actor(this._texture);
        this._texture.set_reactive(true);
        this._texture.connect("motion-event",
                              Lang.bind(this, this._onTextureMotion));
    },

    _onTextureMotion : function() {
        if (this._toolbarId) {
            GLib.source_remove(this._toolbarId);
            delete this._toolbarId;
        } else {
            this._createToolbar();
        }

        this._toolbarId = Mainloop.timeout_add_seconds(2,
                                                       Lang.bind(this,
                                                                 this._onToolbarTimeout));
    },

    _onToolbarTimeout : function() {
        log ("timeoiut");
        delete this._toolbarId;
        this._toolbarActor.destroy();

        return false;
    }
}