const MimeHandler = imports.ui.mimeHandler;

const GdkPixbuf = imports.gi.GdkPixbuf;
const GtkClutter = imports.gi.GtkClutter;

function ImageRenderer(args) {
    this._init(args);
}

ImageRenderer.prototype = {
    _init : function(args) {
    },

    render : function(file) {
        let stream = file.read(null);
        let pix = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
        let texture = new GtkClutter.Texture({ "keep-aspect-ratio": true });
        
        texture.set_from_pixbuf(pix);
    
        return texture;
    }
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
