let MimeHandler = imports.ui.mimeHandler;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;
let GtkSource = imports.gi.GtkSource;

let Sushi = imports.gi.Sushi;

let Utils = imports.ui.utils;

function TextRenderer(args) {
    this._init(args);
}

TextRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = false;
        this.canFullScreen = true;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        this._textLoader = new Sushi.TextLoader();
        this._textLoader.connect("loaded",
                                 Lang.bind(this, this._onBufferLoaded));
        this._textLoader.uri = file.get_uri();
    },

    render : function() {
        return this._actor;
    },

    _onBufferLoaded : function(loader, buffer) {
        this._buffer = buffer;
        this._buffer["highlight-syntax"] = true;

        let styleManager = GtkSource.StyleSchemeManager.get_default();
        let scheme = styleManager.get_scheme("tango");
        this._buffer.set_style_scheme(scheme);

        this._view = new GtkSource.View({ buffer: this._buffer,
                                          editable: false,
                                          "cursor-visible": false });

        if (this._buffer.get_language())
            this._view.set_show_line_numbers(true);

        /* block any button press event */
        this._view.connect("button-press-event",
                           Lang.bind(this, function() {
                               return true;
                           }));

        /* we don't want the ibeam cursor, since we don't allow
         * editing/selecting
         */
        this._view.connect("realize",
                           Lang.bind(this, function() {
                               let window = this._view.get_window(Gtk.TextWindowType.TEXT);
                               window.set_cursor(null);
                           }));

        this._scrolledWin = Gtk.ScrolledWindow.new(null, null);
        this._scrolledWin.add(this._view);
        this._scrolledWin.show_all();    

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._callback();
    },

    getSizeForAllocation : function(allocation) {
        return allocation;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new TextRenderer();

/* register for text/plain and let the mime handler call us
 * for child types.
 */
let mimeTypes = [
    "text/plain",
];

handler.registerMimeTypes(mimeTypes, renderer);