const GdkPixbuf = imports.gi.GdkPixbuf;
const GtkClutter = imports.gi.GtkClutter;
const Gtk = imports.gi.Gtk;

function ImageRenderer(args) {
    this._init(args);
}

ImageRenderer.prototype = {
    _init : function(args) {
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

        if (baseSize[0] <= allocation[0] &&
            baseSize[1] <= allocation[1]) {
            return baseSize;
        }

        let scale = 0;

        if (baseSize[0] > allocation[0] &&
            baseSize[1] <= allocation[1]) {
            scale = allocation[0] / baseSize[0];
        } else if (baseSize[0] <= allocation[0] &&
                   baseSize[1] > allocation[1]) {
            scale = allocation[1] / baseSize[1];
        } else if (baseSize[0] > allocation[0] &&
                   baseSize[1] > allocation[1]) {
            if (baseSize[0] > baseSize[1])
                scale = allocation[0] / baseSize[0];
            else
                scale = allocation[1] / baseSize[1];
        }

        return [ baseSize[0] * scale, baseSize[1] * scale ];
    },

    createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });

        this._toolbarActor.set_size(40, 40);
        this._toolbarActor.set_opacity(0);

        this._toolbarZoom = new Gtk.ToolButton();
        this._toolbarZoom.set_icon_name("view-fullscreen-symbolic");
        this._toolbarZoom.set_expand(true);
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 0);

        this._isFullscreen = false;
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
