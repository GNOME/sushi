const MimeHandler = imports.ui.mimeHandler;
const ClutterGst = imports.gi.ClutterGst;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;

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
            !this._videoHeight) {
            this._allocatedSize = [ 400, 400 ];
            return this._allocatedSize;
        }

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

        this._allocatedSize = [ baseSize[0] * scale, baseSize[1] * scale ];

        return this._allocatedSize;
    },

    clear : function() {
        if (this._videoSizeChangeId) {
            this._video.disconnect(this._videoSizeChangeId);
            delete this._videoSizeChangeId
        }

        delete this._videoWidth;
        delete this._videoHeight;
    },

    createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });
        this._toolbarActor.set_opacity(0);

        this._toolbarActor.add_constraint(
            new Clutter.BindConstraint({ source: this._video,
                                         coordinate: Clutter.BindCoordinate.WIDTH,
                                         offset: -50 }));

        this._toolbarPlay = new Gtk.ToolButton();
        this._toolbarPlay.set_icon_name("media-playback-pause-symbolic");
        this._toolbarPlay.set_expand(false);
        this._toolbarPlay.show();
        this._mainToolbar.insert(this._toolbarPlay, 0);
        this._videoPlaying = true;

        this._toolbarPlay.connect("clicked",
                                  Lang.bind(this, function () {
                                      this._videoPlaying = !this._videoPlaying;
                                      this._video.set_playing(this._videoPlaying);
                                      
                                      if (!this._videoPlaying)
                                          this._toolbarPlay.set_icon_name("media-playback-start-symbolic");
                                      else
                                          this._toolbarPlay.set_icon_name("media-playback-pause-symbolic");
                                  }));

        this._progressBar =
            Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL,
                                     0, 1000, 10);
        this._progressBar.set_draw_value(false);
        this._progressBar.connect("value-changed",
                                  Lang.bind(this, function() {
                                      if (this._progressBar.get_value() != this._videoProgress * 1000)
                                          this._video.set_progress(this._progressBar.get_value() / 1000);
                                  }));

        this._videoProgress = 0;
        this._video.connect("notify::progress",
                            Lang.bind(this, function () {
                                if (this._video.get_progress() == this.videoProgress)
                                    return;

                                this._videoProgress = this._video.get_progress();
                                this._progressBar.set_value(this._videoProgress * 1000);
                            }));

        let item = new Gtk.ToolItem();
        item.set_expand(true);
        item.add(this._progressBar);
        item.show_all();
        this._mainToolbar.insert(item, 1);

        this._toolbarZoom = new Gtk.ToolButton();
        this._toolbarZoom.set_icon_name("view-fullscreen-symbolic");
        this._toolbarZoom.set_expand(false);
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 2);

        this._isFullscreen = false;
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

handler.registerMime("video/mp4", renderer);