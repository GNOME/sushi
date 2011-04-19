const GdkPixbuf = imports.gi.GdkPixbuf;
const GtkClutter = imports.gi.GtkClutter;
const Gtk = imports.gi.Gtk;

let Utils = imports.ui.utils;

function ImageRenderer(args) {
    this._init(args);
}

ImageRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;

        let stream = file.read(null);
        let pix = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
        this._texture = new GtkClutter.Texture({ "keep-aspect-ratio": true });
        
        this._texture.set_from_pixbuf(pix);

        return this._texture;
    },

    getSizeForAllocation : function(allocation) {
        let baseSize = this._texture.get_base_size();

        return Utils.getScaledSize(baseSize, allocation, false);
    },

    createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.MENU);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });

        this._toolbarActor.set_size(32, 32);
        this._toolbarActor.set_opacity(0);

        this._toolbarZoom = new Gtk.ToolButton({ expand: false,
                                                 "icon-name": "view-fullscreen-symbolic" });
        this._toolbarZoom.show();
        this._toolbarZoom.set_expand(true);
        this._mainToolbar.insert(this._toolbarZoom, 0);

        this._toolbarZoom.connect("clicked",
                                  Lang.bind(this, function () {
                                      this._mainWindow.toggleFullScreen();
                                  }));

        return this._toolbarActor;
    },
}

let handler = new MimeHandler.MimeHandler();
let renderer = new ImageRenderer();

let formats = GdkPixbuf.Pixbuf.get_formats();
for (idx in formats) {
    let mimetypes = formats[idx].get_mime_types();
    for (mime in mimetypes) {
        handler.registerMime(mimetypes[mime], renderer);
    }
}
