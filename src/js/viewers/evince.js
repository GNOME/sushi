const Sushi = imports.gi.Sushi;
const EvDoc = imports.gi.EvinceDocument;
const EvView = imports.gi.EvinceView;

let Gettext = imports.gettext.domain("sushi");

let Utils = imports.ui.utils;
let Features = imports.util.features;

let PDF_X_PADDING = 40;
let SPINBOX_SIZE = 150;

function EvinceRenderer(args) {
    this._init(args);
}

EvinceRenderer.prototype = {
    _init : function(args) {
        EvDoc.init();
        this.moveOnClick = false;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;

        this._pdfLoader = new Sushi.PdfLoader();
        this._pdfLoader.connect("notify::document",
                                Lang.bind(this, this._onDocumentLoaded));
        this._pdfLoader.uri = file.get_uri();

        this._spinnerBox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 12);
        this._spinnerBox.show();

        let spinner = Gtk.Spinner.new();
        spinner.show();
        spinner.start();
        this._spinnerBox.pack_start(spinner, true, true, 0);

        let label = new Gtk.Label();
        label.set_text(Gettext.gettext("Loading..."));
        label.show();
        this._spinnerBox.pack_start(label, true, true, 0);

        this._actor = new GtkClutter.Actor({ contents: this._spinnerBox });
        this._actor.set_reactive(true);

        return this._actor;
    },

    _onDocumentLoaded : function() {
        this._spinnerBox.destroy();

        this._document = this._pdfLoader.document;
        this._model = EvView.DocumentModel.new_with_document(this._document);

        this._model.set_sizing_mode(EvView.SizingMode.FIT_WIDTH);
	this._model.set_continuous(true);

        this._view = EvView.View.new();
        this._view.show();

        this._scrolledWin = Gtk.ScrolledWindow.new(null, null);
        this._scrolledWin.set_min_content_width(Constants.VIEW_MIN);
        this._scrolledWin.set_min_content_height(Constants.VIEW_MIN);
        this._scrolledWin.show();

        this._view.set_model(this._model);
        this._scrolledWin.add(this._view);

        this._actor.get_widget().add(this._scrolledWin);

        let pageSize = this._pdfLoader.get_max_page_size();
        this._pageWidth = Math.floor(pageSize[0]);
        this._pageHeight = Math.floor(pageSize[1]);

        this._mainWindow.refreshSize();
    },

    getSizeForAllocation : function(allocation) {
        let width = this._pageWidth + PDF_X_PADDING;
        let height = this._pageHeight;

        if (!this._document) {
            [ width, height ] = [ SPINBOX_SIZE, SPINBOX_SIZE ];
        } else {
            let scaledSize = Utils.getScaledSize([ width, height ],
                                                 allocation,
                                                 true);

            [ width, height ] = scaledSize;
        }

        return [ width, height ];
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.MENU);
        this._mainToolbar.show();

        this._toolbarZoom = new Gtk.ToolButton({ expand: false,
                                                 "icon-name": "view-fullscreen-symbolic" });
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 0);

        this._toolbarZoom.connect("clicked",
                                  Lang.bind(this, function () {
                                      this._mainWindow.toggleFullScreen();
                                  }));

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar,
                                                    opacity: 0});
        this._toolbarActor.set_size(32, 32);

        return this._toolbarActor;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new EvinceRenderer();

handler.registerMime("application/pdf", renderer);

if (Features.HAVE_UNOCONV) {
    handler.registerMime("application/vnd.oasis.opendocument.text", renderer);
    handler.registerMime("application/vnd.oasis.opendocument.presentation", renderer);
    handler.registerMime("application/vnd.oasis.opendocument.spreadsheet", renderer);
    handler.registerMime("application/msword", renderer);
    handler.registerMime("application/vnd.ms-excel", renderer);
    handler.registerMime("application/vnd.ms-powerpoint", renderer);
    handler.registerMime("application/rtf", renderer);
}
