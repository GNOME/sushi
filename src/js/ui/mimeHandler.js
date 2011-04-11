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
    },

    registerMime: function(mime, obj) {
        this._mimeTypes[mime] = obj;

        log ("Register mimetype " + mime);
    },

    getObject: function(mime) {
        return this._mimeTypes[mime];
    }
}