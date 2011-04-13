const Gst = imports.gi.Gst;
const Sushi = imports.gi.Sushi;

function AudioRenderer(args) {
    this._init(args);
}

AudioRenderer.prototype = {
    _init : function() {
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;
        this._createPlayer(file);

        this._box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                  spacing: 6 });
        let image = new Gtk.Image({ "icon-name": "media-optical-symbolic",
                                    "pixel-size": 256 });
        this._box.pack_start(image, false, false, 0);

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 6 });
        this._box.pack_start(vbox, false, false, 0);

        this._titleLabel = new Gtk.Label({ label: 'Title: ' + file.get_basename() });
        this._titleLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._titleLabel, false, false, 6);

        this._authorLabel = new Gtk.Label({ label: 'Author: '});
        this._authorLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._authorLabel, false, false, 6);

        this._albumLabel = new Gtk.Label({ label: 'Album: ' });
        this._albumLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._albumLabel, false, false, 6);

        this._box.show_all();
        this._actor = new GtkClutter.Actor({ contents: this._box });

        return this._actor;
    },

    _createPlayer : function(file) {
        this._player = new Sushi.SoundPlayer({ uri: file.get_uri() });
        this._player.playing = true;

        this._player.connect("notify::progress",
                             Lang.bind(this,
                                       this._onPlayerProgressChanged));
        this._player.connect("notify::duration",
                             Lang.bind(this,
                                       this._onPlayerDurationChanged));
        this._player.connect("notify::state",
                             Lang.bind(this,
                                       this._onPlayerStateChanged));
    },

    _updateProgressBar : function() {
        if (!this._mainToolbar)
            return;

        this._isSettingValue = true;
        this._progressBar.set_value(this._player.progress * 1000);
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
            Math.floor(this._player.duration * this._player.progress);

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

        let totalTime = this._player.duration;

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

    _onPlayerProgressChanged : function() {
        this._updateProgressBar();
        this._updateCurrentLabel();
    },

    _onPlayerDurationChanged : function() {
        this._updateDurationLabel();
    },

    _onPlayerStateChanged : function() {
        switch(this._player.state) {
        case Sushi.SoundPlayerState.PLAYING:
            this._toolbarPlay.set_icon_name("media-playback-pause-symbolic");
            break;
        default:
            this._toolbarPlay.set_icon_name("media-playback-start-symbolic");
        }
    },

    getSizeForAllocation : function(allocation) {
        let width = this._box.get_preferred_width();
        let height = this._box.get_preferred_height();

        /* return the natural */
        return [ width[1], height[1] ];
    },

    clear : function() {
    },

    createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });
        this._toolbarActor.set_opacity(0);

        this._toolbarActor.add_constraint(
            new Clutter.BindConstraint({ source: this._actor,
                                         coordinate: Clutter.BindCoordinate.WIDTH,
                                         offset: -50 }));

        this._toolbarPlay = new Gtk.ToolButton();
        this._toolbarPlay.set_icon_name("media-playback-pause-symbolic");
        this._toolbarPlay.set_expand(false);
        this._toolbarPlay.show();
        this._mainToolbar.insert(this._toolbarPlay, 0);

        this._currentLabel = new Gtk.Label();
        let item = new Gtk.ToolItem();
        item.set_expand(false);
        item.add(this._currentLabel);
        item.show_all();
        this._mainToolbar.insert(item, 1);


        this._toolbarPlay.connect("clicked",
                                  Lang.bind(this, function () {
                                      let playing = !this._player.playing;
                                      this._player.playing = playing;
                                  }));

        this._progressBar =
            Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL,
                                     0, 1000, 10);
        this._progressBar.set_value(0);
        this._progressBar.set_draw_value(false);
        this._progressBar.connect("value-changed",
                                  Lang.bind(this, function() {
                                      if(!this._isSettingValue)
                                          this._player.progress = this._progressBar.get_value() / 1000;
                                  }));

        let item = new Gtk.ToolItem();
        item.set_expand(true);
        item.add(this._progressBar);
        item.show_all();
        this._mainToolbar.insert(item, 2);

        this._durationLabel = new Gtk.Label();
        let item = new Gtk.ToolItem();
        item.set_expand(false);
        item.add(this._durationLabel);
        item.show_all();
        this._mainToolbar.insert(item, 3);

        return this._toolbarActor;
    },
}

let handler = new MimeHandler.MimeHandler();
let renderer = new AudioRenderer();

handler.registerMime("audio/mpeg", renderer);