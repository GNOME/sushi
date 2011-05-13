let MimeHandler = imports.ui.mimeHandler;
let GdkPixbuf = imports.gi.GdkPixbuf;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;

let Gettext = imports.gettext.domain("sushi");
let _ = Gettext.gettext;

let Utils = imports.ui.utils;

function ImageRenderer(args) {
    this._init(args);
}

ImageRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
        this.canFullScreen = true;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        this._createImageTexture(file);
    },

    render : function() {
        return this._texture;
    },

    _createImageTexture : function(file) {
        file.read_async
        (GLib.PRIORITY_DEFAULT, null,
         Lang.bind(this,
                   function(obj, res) {
                       try {
                           let stream = obj.read_finish(res);
                           this._textureFromStream(stream);
                       } catch (e) {
                       }
                   }));
    },

    _textureFromStream : function(stream) {
        GdkPixbuf.Pixbuf.new_from_stream_async
        (stream, null,
         Lang.bind(this, function(obj, res) {
             let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);

             this._texture = new GtkClutter.Texture({ "keep-aspect-ratio": true });
             this._texture.set_from_pixbuf(pix);

             /* we're ready now */
             this._callback();

             stream.close_async(GLib.PRIORITY_DEFAULT,
                                null, null, null);
         }));
    },

    getSizeForAllocation : function(allocation, fullScreen) {
        let baseSize = this._texture.get_base_size();
        return Utils.getScaledSize(baseSize, allocation, fullScreen);
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar({ "icon-size": Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_show_arrow(false);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });

        this._toolbarZoom = Utils.createFullScreenButton(this._mainWindow);
        this._mainToolbar.insert(this._toolbarZoom, 0);

        return this._toolbarActor;
    },
}

let handler = new MimeHandler.MimeHandler();
let renderer = new ImageRenderer();

let formats = GdkPixbuf.Pixbuf.get_formats();
for (idx in formats) {
    let mimeTypes = formats[idx].get_mime_types();
    handler.registerMimeTypes(mimeTypes, renderer);
}
