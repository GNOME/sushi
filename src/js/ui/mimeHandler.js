const FallbackRenderer = imports.ui.fallbackRenderer;

let Gio = imports.gi.Gio;

let _mimeHandler = null;

function MimeHandler() {
    if (_mimeHandler == null) {
        this._init();
        _mimeHandler = this;
    }

    return _mimeHandler;
}

function init() {
    let handler = new MimeHandler();
}

MimeHandler.prototype = {
    _init: function() {
        this._mimeTypes = [];

        this._fallbackRenderer = new FallbackRenderer.FallbackRenderer();
    },

    registerMime: function(mime, obj) {
        this._mimeTypes[mime] = obj;

        log ("Register mimetype " + mime);
    },

    registerMimeTypes: function(mimeTypes, obj) {
        for (idx in mimeTypes)
            this.registerMime(mimeTypes[idx], obj);
    },

    getObject: function(mime) {
        if (this._mimeTypes[mime]) {
            /* first, try a direct match with the mimetype itself */
            return this._mimeTypes[mime];
        } else {
            /* if this fails, try to see if we have any handlers
             * registered for a parent type.
             */
            for (key in this._mimeTypes) {
                if (Gio.content_type_is_a (mime, key))
                    return this._mimeTypes[key];
            }

            /* finally, resort to the fallback renderer */
            return this._fallbackRenderer;
        }
    }
}
