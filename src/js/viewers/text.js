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
        this._view.set_can_focus(false);

        if (this._buffer.get_language())
            this._view.set_show_line_numbers(true);

        // FIXME: *very* ugly wokaround to the fact that we can't
        // access event.button from a button-press callback to block
        // right click
        this._view.connect("populate-popup",
                           Lang.bind(this, function(widget, menu) {
                               menu.destroy();
                           }));

        this._scrolledWin = Gtk.ScrolledWindow.new(null, null);
        this._scrolledWin.add(this._view);
        this._scrolledWin.show_all();    

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._actor.set_reactive(true);
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