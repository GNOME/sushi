// util imports
const Path = imports.util.path;

// gi imports
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

const MainWindow = imports.ui.mainWindow;

function Application(args) {
    this._init(args);
}

Application.prototype = {
    _init : function(args) {
        this._defineStyleAndThemes();
        this._createMainWindow();

        this._mainWindow.showAll();
    },

    _createMainWindow : function() {
        this._mainWindow =
            new MainWindow.MainWindow({ application: this });
    },

    _defineStyleAndThemes : function() {
        let provider = new Gtk.CssProvider();
        provider.load_from_path(Path.STYLE_DIR + "gtk-style.css");
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
                                                 provider,
                                                 600);
    },

    quit : function() {
        Gtk.main_quit();
    }
}