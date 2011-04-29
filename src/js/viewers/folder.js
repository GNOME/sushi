let MimeHandler = imports.ui.mimeHandler;
let Gtk = imports.gi.Gtk;
let Gettext = imports.gettext.domain("sushi");

let Sushi = imports.gi.Sushi;

let Constants = imports.util.constants;
let Utils = imports.ui.utils;

function FolderRenderer(args) {
    this._init(args);
}

FolderRenderer.prototype = {
    _init : function() {
        this._moveOnClick = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;
        this.lastWidth = 0;
        this.lastHeight = 0;

        this._folderLoader = new Sushi.FileLoader();
        this._folderLoader.connect("notify::size",
                                   Lang.bind(this, this._onFolderInfoChanged));
        this._folderLoader.connect("notify::icon",
                                   Lang.bind(this, this._onFolderInfoChanged));
        this._folderLoader.connect("notify::time",
                                   Lang.bind(this, this._onFolderInfoChanged));
        this._folderLoader.connect("notify::name",
                                   Lang.bind(this, this._onFolderInfoChanged));

        this._folderLoader.file = file;

        this._box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                  spacing: 6 });
        this._image = new Gtk.Image({ "icon-name": "folder",
                                      "pixel-size": 256 });
        this._box.pack_start(this._image, false, false, 0);

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 "margin-top": 48,
                                 "margin-left": 12,
                                 "margin-right": 12 });
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
	let name = this._folderLoader.name;
	if (!name) {
	    try {
		name = this._folderLoader.file.get_basename()
	    } catch (e) {
		name = "";
	    }
	}
        let titleStr =
            "<b><big>" + name + "</big></b>";

        let sizeStr =
            "<small><b>" + Gettext.gettext("Size") + "  </b>" +
            ((this._folderLoader.size) ? (this._folderLoader.size) : (Gettext.gettext("Loading...")))
             + "</small>";

        let dateStr =
            "<small><b>" + Gettext.gettext("Modified") + "  </b>" +
             ((this._folderLoader.time) ? (this._folderLoader.time) : (Gettext.gettext("Loading...")))
             + "</small>";

        this._titleLabel.set_markup(titleStr);
        this._sizeLabel.set_markup(sizeStr);
        this._dateLabel.set_markup(dateStr);
    },

    _onFolderInfoChanged : function() {
        if (!this._folderLoader.get_loading()) {
            this._spinner.stop();
            this._spinner.hide();
        }

        this._applyLabels();
        this._image.set_from_pixbuf(this._folderLoader.icon);
        this._mainWindow.refreshSize();
    },

    createToolbar : function() {
        return null;
    },

    clear : function() {
        this._folderLoader.stop();
        delete this._folderLoader;
    },

    getSizeForAllocation : function(allocation) {
        return Utils.getStaticSize(this, this._box);
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new FolderRenderer();

handler.registerMime("inode/directory", renderer);
