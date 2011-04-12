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
