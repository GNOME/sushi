// util imports
const Path = imports.util.path;

// gi imports
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mx = imports.gi.Mx;

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
        let mxIcontheme = Mx.IconTheme.get_default();
        mxIcontheme.set_search_paths([Path.ICONS_DIR]);

        let gtkIcontheme = Gtk.IconTheme.get_default();
        gtkIcontheme.append_search_path(Path.ICONS_DIR);

        let style = Mx.Style.get_default();
        style.load_from_file(Path.STYLE_DIR + "style.css");
    }
}