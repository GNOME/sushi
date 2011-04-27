let Gtk = imports.gi.Gtk;
let Gettext = imports.gettext.domain("sushi");

let Sushi = imports.gi.Sushi;

let Constants = imports.util.constants;
let Utils = imports.ui.utils;

function FallbackRenderer(args) {
    this._init(args);
}

FallbackRenderer.prototype = {
    _init : function() {
        this._moveOnClick = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;
        this.lastWidth = 0;
        this.lastHeight = 0;

        this._fileLoader = new Sushi.FileLoader();
        this._fileLoader.connect("notify::size",
                                 Lang.bind(this, this._onFileInfoChanged));
        this._fileLoader.connect("notify::icon",
                                 Lang.bind(this, this._onFileInfoChanged));
        this._fileLoader.connect("notify::time",
                                 Lang.bind(this, this._onFileInfoChanged));
        this._fileLoader.connect("notify::name",
                                 Lang.bind(this, this._onFileInfoChanged));

        this._fileLoader.file = file;

        this._box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                  spacing: 6 });
        this._image = new Gtk.Image({ "icon-name": "document",
                                      "pixel-size": 256 });
        this._box.pack_start(this._image, false, false, 0);

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 "margin-top": 48,
                                 "margin-left": 12,
                                 "margin-right": 6 });
        this._box.pack_start(vbox, false, false, 0);

        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 spacing: 6 });
        vbox.pack_start(hbox, false, false, 0);

        this._titleLabel = new Gtk.Label();
        this._titleLabel.set_halign(Gtk.Align.START);
        hbox.pack_start(this._titleLabel, false, false, 0);

        this._spinner = new Gtk.Spinner();
        hbox.pack_start(this._spinner, false, false, 0);
        this._spinner.start();

        this._typeLabel = new Gtk.Label();
        this._typeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._typeLabel, false, false, 0);

        this._sizeLabel = new Gtk.Label();
        this._sizeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._sizeLabel, false, false, 0);

        this._dateLabel = new Gtk.Label();
        this._dateLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._dateLabel, false, false, 0);

        this._applyLabels();

        this._box.show_all();
        this._actor = new GtkClutter.Actor({ contents: this._box });

        return this._actor;
    },

    _applyLabels : function() {
        let titleStr = 
            "<b><big>" + 
            ((this._fileLoader.name) ? (this._fileLoader.name) : (this._fileLoader.file.get_basename()))
            + "</big></b>";

        let typeStr =
            "<small><b>" + Gettext.gettext("Type") + "  </b>" +
            ((this._fileLoader.contentType) ? (this._fileLoader.contentType) : (Gettext.gettext("Loading...")))
             + "</small>";

        let sizeStr =
            "<small><b>" + Gettext.gettext("Size") + "  </b>" +
            ((this._fileLoader.size) ? (this._fileLoader.size) : (Gettext.gettext("Loading...")))
             + "</small>";

        let dateStr =
            "<small><b>" + Gettext.gettext("Modified") + "  </b>" +
             ((this._fileLoader.time) ? (this._fileLoader.time) : (Gettext.gettext("Loading...")))
             + "</small>";

        this._titleLabel.set_markup(titleStr);
        this._typeLabel.set_markup(typeStr);
        this._sizeLabel.set_markup(sizeStr);
        this._dateLabel.set_markup(dateStr);
    },

    _onFileInfoChanged : function() {
        if (!this._fileLoader.get_loading()) {
            this._spinner.stop();
            this._spinner.hide();
        }

        if (this._fileLoader.icon)
            this._image.set_from_pixbuf(this._fileLoader.icon);

        this._applyLabels();
        this._mainWindow.refreshSize();
    },

    createToolbar : function() {
        return null;
    },

    clear : function() {
        this._fileLoader.stop();
        delete this._fileLoader;
    },

    getSizeForAllocation : function(allocation) {
        return Utils.getStaticSize(this, this._box);
    }
}
