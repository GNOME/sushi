const MimeHandler = imports.ui.mimeHandler;
const ClutterGst = imports.gi.ClutterGst;
const Gdk = imports.gi.Gdk;

const Lang = imports.lang;

function GstRenderer(args) {
    this._init(args);
}

GstRenderer.prototype = {
    _init : function(args) {
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;

        this._video =
            new ClutterGst.VideoTexture({ "sync-size": false });

        this._video.set_filename(file.get_path());
        this._video.playing = true;

        this._videoSizeChangeId =
            this._video.connect("size-change",
                                Lang.bind(this,
                                          this._onVideoSizeChange));

        return this._video;
    },

    getSizeForAllocation : function(allocation) {
        if (!this._videoWidth ||
            !this._videoHeight)
            return [ 400, 400 ];

        let baseSize = [ this._videoWidth, this._videoHeight ];
        let scale = 0;

        if (baseSize[0] <= allocation[0] &&
            baseSize[1] <= allocation[1]) {
            /* upscale */
            if (baseSize[0] > baseSize[1])
                scale = allocation[0] / baseSize[0];
            else
                scale = allocation[1] / baseSize[1];
        } else if (baseSize[0] > allocation[0] &&
                   baseSize[1] <= allocation[1]) {
            /* downscale x */
            scale = allocation[0] / baseSize[0];
        } else if (baseSize[0] <= allocation[0] &&
                   baseSize[1] > allocation[1]) {
            /* downscale y */
            scale = allocation[1] / baseSize[1];
        } else if (baseSize[0] > allocation[0] &&
                   baseSize[1] > allocation[1]) {
            /* downscale x/y */
            if (baseSize[0] > baseSize[1])
                scale = allocation[0] / baseSize[0];
            else
                scale = allocation[1] / baseSize[1];
        }

        return [ baseSize[0] * scale, baseSize[1] * scale ];
    },

    clear : function() {
        if (this._videoSizeChangeId) {
            this._video.disconnect(this._videoSizeChangeId);
            delete this._videoSizeChangeId
        }

        delete this._videoWidth;
        delete this._videoHeight;
    },

    _onVideoSizeChange : function(video, width, height) {
        this._videoWidth = width;
        this._videoHeight = height;

        this._mainWindow.refreshSize();
    },
}

let handler = new MimeHandler.MimeHandler();
let renderer = new GstRenderer();

handler.registerMime("video/mp4", renderer);