let MimeHandler = imports.ui.mimeHandler;
let GdkPixbuf = imports.gi.GdkPixbuf;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;
let Gettext = imports.gettext.domain("sushi");

let Utils = imports.ui.utils;

let SPINNER_SIZE = 48;

function ImageRenderer(args) {
    this._init(args);
}

ImageRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
        this.canFullScreen = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;

        this._spinnerBox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 12);
        this._spinnerBox.show();

        let spinner = Gtk.Spinner.new();
        spinner.show();
        spinner.start();
        spinner.set_size_request(SPINNER_SIZE, SPINNER_SIZE);

        this._spinnerBox.pack_start(spinner, true, true, 0);

        let label = new Gtk.Label();
        label.set_text(Gettext.gettext("Loading..."));
        label.show();
        this._spinnerBox.pack_start(label, true, true, 0);

        this._spinnerActor = new GtkClutter.Actor({ contents: this._spinnerBox });

        this._group = new Clutter.Group({ clipToAllocation: true });
        this._group.add_actor(this._spinnerActor);

        this._spinnerActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._group,
                                          "align-axis": Clutter.AlignAxis.Y_AXIS,
                                          factor: 0.5 }));
        this._spinnerActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._group,
                                          "align-axis": Clutter.AlignAxis.X_AXIS,
                                          factor: 0.5 }));

        this._createImageTexture(file);

        return this._group;
    },

    _createImageTexture : function(file) {
        file.read_async
        (GLib.PRIORITY_DEFAULT, null,
         Lang.bind(this,
                   function(obj, res) {
                       try {
                           let stream = obj.read_finish(res);
                           this._textureFromStream(stream);
                       } catch (e) {
                       }
                   }));
    },

    _textureFromStream : function(stream) {
        GdkPixbuf.Pixbuf.new_from_stream_async
        (stream, null,
         Lang.bind(this, function(obj, res) {
             try {
                 let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);

                 this._texture = new GtkClutter.Texture({ "keep-aspect-ratio": true });
                 this._texture.set_from_pixbuf(pix);

                 this._texture.add_constraint(
                     new Clutter.BindConstraint({ source: this._group,
                                                  coordinate: Clutter.BindCoordinate.SIZE }));

                 this._mainWindow.refreshSize();

                 this._group.add_actor(this._texture);
                 this._spinnerActor.destroy();

                 this._toolbarActor.show();
             } catch(e) {
             }}));
    },

    getSizeForAllocation : function(allocation, fullScreen) {
        if (!this._texture) {
            [ width, height ] = [ this._spinnerBox.get_preferred_size()[0].width,
                                  this._spinnerBox.get_preferred_size()[0].height ];
        } else {
            let baseSize = this._texture.get_base_size();

            [ width, height ] = Utils.getScaledSize(baseSize, allocation, fullScreen);
        }

        return [ width, height ];
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar({ "icon-size": Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_show_arrow(false);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar,
                                                    "show-on-set-parent": false });

        this._toolbarZoom = new Gtk.ToolButton({ expand: false,
                                                 "icon-name": "view-fullscreen-symbolic" });
        this._toolbarZoom.show();
        this._toolbarZoom.set_expand(true);
        this._mainToolbar.insert(this._toolbarZoom, 0);

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
