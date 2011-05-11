let MimeHandler = imports.ui.mimeHandler;
let ClutterGst = imports.gi.ClutterGst;
let Clutter = imports.gi.Clutter;
let Gdk = imports.gi.Gdk;
let GObject = imports.gi.GObject;

let Lang = imports.lang;

let Utils = imports.ui.utils;
let Constants = imports.util.constants;

function GstRenderer(args) {
    this._init(args);
}

GstRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
        this.canFullScreen = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;
        this._createVideo(file);

        return this._video;
    },

    clear : function() {
        this._video.playing = false;
    },

    _createVideo : function(file) {
        this._video =
            new ClutterGst.VideoTexture({ "sync-size": false });

        this._video.set_filename(file.get_path());
        this._video.playing = true;

        this._videoSizeChangeId =
            this._video.connect("size-change",
                                Lang.bind(this,
                                          this._onVideoSizeChange));
        this._video.connect("notify::playing",
                            Lang.bind(this,
                                      this._onVideoPlayingChange))
        this._video.connect("notify::progress",
                            Lang.bind(this,
                                      this._onVideoProgressChange));
        this._video.connect("notify::duration",
                            Lang.bind(this,
                                      this._onVideoDurationChange));
    },

    _updateProgressBar : function() {
        if (!this._mainToolbar)
            return;

        this._isSettingValue = true;
        this._progressBar.set_value(this._video.progress * 1000);
        this._isSettingValue = false;
    },

    _formatTimeComponent : function(n) {
        // FIXME: we need a sprinf equivalent to do
        // proper formatting here.
        return (n >= 10 ? n : "0" + n);
    },

    _updateCurrentLabel : function() {
        if (!this._mainToolbar)
            return;

        let currentTime =
            Math.floor(this._video.duration * this._video.progress);

        let hours = Math.floor(currentTime / 3600);
        currentTime -= hours * 3600;

        let minutes = Math.floor(currentTime / 60);
        currentTime -= minutes * 60;

        let seconds = Math.floor(currentTime);

        let current = this._formatTimeComponent(minutes) + ":" +
            this._formatTimeComponent(seconds);
        if (hours > 0) {
            current = this._formatTimeComponent(hours) + ":" + current;
        }

        this._currentLabel.set_text(current);
    },

    _updateDurationLabel : function() {
        if (!this._mainToolbar)
            return;

        let totalTime = this._video.duration;

        let hours = Math.floor(totalTime / 3600);
        totalTime -= hours * 3600;

        let minutes = Math.floor(totalTime / 60);
        totalTime -= minutes * 60;

        let seconds = Math.floor(totalTime);

        let total = this._formatTimeComponent(minutes) + ":" +
            this._formatTimeComponent(seconds);
        if (hours > 0) {
            this._formatTimeComponent(hours) + ":" + total;
        }

        this._durationLabel.set_text(total);
    },

    _onVideoProgressChange : function() {
        this._updateCurrentLabel();
        this._updateProgressBar();
    },

    _onVideoDurationChange : function() {
        this._updateDurationLabel();
    },

    _onVideoPlayingChange : function() {
        if (this._video.playing)
            this._toolbarPlay.set_icon_name("media-playback-pause-symbolic");
        else
            this._toolbarPlay.set_icon_name("media-playback-start-symbolic");
    },

    getSizeForAllocation : function(allocation) {
        if (!this._videoWidth ||
            !this._videoHeight) {
            return [ Constants.VIEW_MIN, Constants.VIEW_MIN ];
        }

        let baseSize = [ this._videoWidth, this._videoHeight ];

        return Utils.getScaledSize(baseSize, allocation, true);
    },

    createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar({ "icon-size": Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar,
                                                    opacity: 0 });
        this._toolbarActor.add_constraint(
            new Clutter.BindConstraint({ source: this._video,
                                         coordinate: Clutter.BindCoordinate.WIDTH,
                                         offset: -50 }));

        this._toolbarPlay = new Gtk.ToolButton({ "icon-name": "media-playback-pause-symbolic" });
        this._toolbarPlay.show();
        this._mainToolbar.insert(this._toolbarPlay, 0);

        this._currentLabel = new Gtk.Label({ "margin-left": 6,
                                             "margin-right": 3 });
        let item = new Gtk.ToolItem();
        item.add(this._currentLabel);
        item.show_all();
        this._mainToolbar.insert(item, 1);

        this._toolbarPlay.connect("clicked",
                                  Lang.bind(this, function () {
                                      let playing = !this._video.playing;
                                      this._video.playing = playing;
                                  }));

        this._progressBar =
            Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL,
                                     0, 1000, 10);
        this._progressBar.set_value(0);
        this._progressBar.set_draw_value(false);
        this._progressBar.connect("value-changed",
                                  Lang.bind(this, function() {
                                      if(!this._isSettingValue)
                                          this._video.progress = this._progressBar.get_value() / 1000;
                                  }));

        let item = new Gtk.ToolItem();
        item.set_expand(true);
        item.add(this._progressBar);
        item.show_all();
        this._mainToolbar.insert(item, 2);

        this._durationLabel = new Gtk.Label({ "margin-left": 3,
                                              "margin-right": 6 });
        let item = new Gtk.ToolItem();
        item.add(this._durationLabel);
        item.show_all();
        this._mainToolbar.insert(item, 3);

        this._toolbarZoom = new Gtk.ToolButton({ "icon-name": "view-fullscreen-symbolic" });
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 4);

        this._toolbarZoom.connect("clicked",
                                  Lang.bind(this, function () {
                                      this._mainWindow.toggleFullScreen();
                                  }));

        return this._toolbarActor;
    },

    _onVideoSizeChange : function(video, width, height) {
        this._videoWidth = width;
        this._videoHeight = height;

        this._mainWindow.refreshSize();
    },
}

let handler = new MimeHandler.MimeHandler();
let renderer = new GstRenderer();

let videoTypes = [
    "application/mxf",
    "application/ogg",
    "application/ram",
    "application/sdp",
    "application/vnd.ms-wpl",
    "application/vnd.rn-realmedia",
    "application/x-extension-m4a",
    "application/x-extension-mp4",
    "application/x-flash-video",
    "application/x-matroska",
    "application/x-netshow-channel",
    "application/x-ogg",
    "application/x-quicktimeplayer",
    "application/x-shorten",
    "image/vnd.rn-realpix",
    "image/x-pict",
    "misc/ultravox",
    "text/x-google-video-pointer",
    "video/3gpp",
    "video/dv",
    "video/fli",
    "video/flv",
    "video/mp2t",
    "video/mp4",
    "video/mp4v-es",
    "video/mpeg",
    "video/msvideo",
    "video/ogg",
    "video/quicktime",
    "video/vivo",
    "video/vnd.divx",
    "video/vnd.rn-realvideo",
    "video/vnd.vivo",
    "video/webm",
    "video/x-anim",
    "video/x-avi",
    "video/x-flc",
    "video/x-fli",
    "video/x-flic",
    "video/x-flv",
    "video/x-m4v",
    "video/x-matroska",
    "video/x-mpeg",
    "video/x-ms-asf",
    "video/x-ms-asx",
    "video/x-msvideo",
    "video/x-ms-wm",
    "video/x-ms-wmv",
    "video/x-ms-wmx",
    "video/x-ms-wvx",
    "video/x-nsv",
    "video/x-ogm+ogg",
    "video/x-theora+ogg",
    "video/x-totem-stream"
];

handler.registerMimeTypes(videoTypes, renderer);
