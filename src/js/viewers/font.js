let MimeHandler = imports.ui.mimeHandler;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;

let Sushi = imports.gi.Sushi;

function FontRenderer(args) {
    this._init(args);
}

FontRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
        this.canFullScreen = false;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        this._fontWidget = new Sushi.FontWidget({ uri: file.get_uri() });
        this._fontWidget.show();
        this._fontWidget.connect("loaded",
                                 Lang.bind(this, this._onFontLoaded));

        this._fontActor = new GtkClutter.Actor({ contents: this._fontWidget });
    },

    _onFontLoaded : function() {
        this._callback();
    },

    render : function(file, mainWindow) {
        return this._fontActor;
    },

    getSizeForAllocation : function(allocation) {
        let size = [ this._fontWidget.get_preferred_size()[1].width,
                     this._fontWidget.get_preferred_size()[1].height ];

        if (size[0] > allocation[0])
            size[0] = allocation[0];

        if (size[1] > allocation[1])
            size[1] = allocation[1];

        return size;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new FontRenderer();

let mimeTypes = [
    "application/x-font-ttf",
    "application/x-font-otf",
    "application/x-font-pcf",
    "application/x-font-type1"
];

handler.registerMimeTypes(mimeTypes, renderer);
