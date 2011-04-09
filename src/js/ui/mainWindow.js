const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Clutter = imports.gi.Clutter;
const Mx = imports.gi.Mx;

const Cairo = imports.cairo;
const Lang = imports.lang;

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

        this._createMainBox();
        this._createToolbar();
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
        this._stage.set_opacity(128);
        this._stage.set_size(400, 400);
        this._gtkWindow.resize(400, 400);
    },

    _connectStageSignals : function() {
        this._stage.connect("key-press-event",
                            Lang.bind(this, this._onStageKeyPressEvent));
    },

    _createMainBox : function() {
        this._mainBox =
            new Mx.BoxLayout({ orientation: Mx.Orientation.VERTICAL,
                               reactive: true,
                               name: "main-window-main-box" });

        this._stage.add_actor(this._mainBox);
        this._stage.show();

        let widthConstraint =
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.WIDTH,
                                         offset: 0.0 });
        this._mainBox.add_constraint(widthConstraint);

        let heightConstraint =
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.HEIGHT,
                                         offset: 0.0 });
        this._mainBox.add_constraint(heightConstraint);
    },

    _createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        let actor = new GtkClutter.Actor({ contents: this._mainToolbar });
        actor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        let yConstraint = 
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: this._stage.height - 52 });
        actor.add_constraint(yConstraint);

        actor.set_size(100, 40);
        actor.set_opacity(128);
        this._stage.add_actor(actor);

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
    }
}