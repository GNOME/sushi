const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;

function MainWindow(args) {
    this._init(args);
}

MainWindow.prototype = {
    _init : function(args) {
        args = args || {};

        this._application = args.application;

        this._createGtkWindow();
        this._createClutterEmbed();
    },

    _createGtkWindow : function() {
        Gtk.Window.set_default_icon_name("system-file-manager");

        this._gtkWindow =
            new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL,
                             typeHint: Gdk.WindowTypeHint.NORMAL,
                             title: "Nautilus Preview",
                             focusOnMap: true,
                             hasResizeGrip: true,
                             deletable: false,
                             decorated: false,
                             skipTaskbarHint: true,
                             skipPagerHint: true, });

        this._gtkWindow.defaultWidth = 400;
        this._gtkWindow.defaultHeight = 400;
    },

    _createClutterEmbed : function() {
        this._clutterEmbed = new GtkClutter.Embed();
        this._gtkWindow.add(this._clutterEmbed);

        this._clutterEmbed.set_receives_default(true);
        this._clutterEmbed.set_can_default(true);

        this._stage = this._clutterEmbed.get_stage();
    },

    showAll : function() {
        this._gtkWindow.show_all();
    }
}