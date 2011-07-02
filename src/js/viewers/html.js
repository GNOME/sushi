let MimeHandler = imports.ui.mimeHandler;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;
let WebKit = imports.gi.WebKit;

let Sushi = imports.gi.Sushi;

let Utils = imports.ui.utils;

function HTMLRenderer(args) {
    this._init(args);
}

HTMLRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = false;
        this.canFullScreen = true;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        this._webView = WebKit.WebView.new();
        this._scrolledWin = Gtk.ScrolledWindow.new (null, null);
        this._scrolledWin.add(this._webView);
        this._scrolledWin.show_all();

        /* disable the default context menu of the web view */
        let settings = this._webView.settings;
        settings["enable-default-context-menu"] = false;

        this._webView.load_uri(file.get_uri());

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._actor.set_reactive(true);

        this._callback();
    },

    render : function() {
        return this._actor;
    },

    getSizeForAllocation : function(allocation) {
        return allocation;
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar({ "icon-size": Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_show_arrow(false);

        this._toolbarZoom = Utils.createFullScreenButton(this._mainWindow);
        this._mainToolbar.insert(this._toolbarZoom, 0);

        let separator = new Gtk.SeparatorToolItem();
        separator.show();
        this._mainToolbar.insert(separator, 1);

        this._toolbarRun = Utils.createRunButton(this._file, this._mainWindow);
        this._mainToolbar.insert(this._toolbarRun, 2);

        this._mainToolbar.show();

        this._toolbarActor = Utils.forcedSizeActor(this._mainToolbar);

        return this._toolbarActor;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new HTMLRenderer();

let mimeTypes = [
    "text/html",
];

handler.registerMimeTypes(mimeTypes, renderer);
