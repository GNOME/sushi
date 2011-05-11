const FallbackRenderer = imports.ui.fallbackRenderer;

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
        if (this._mimeTypes[mime])
            return this._mimeTypes[mime];
        else
            return this._fallbackRenderer;
    }
}