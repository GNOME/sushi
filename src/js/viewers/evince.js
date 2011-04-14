const Sushi = imports.gi.Sushi;
const EvDoc = imports.gi.EvinceDocument;
const EvView = imports.gi.EvinceView;

let Utils = imports.ui.utils;

const PDF_X_PADDING = 40;

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

        this._view = EvView.View.new();
        this._view.show();

        this._scrolledWin = Gtk.ScrolledWindow.new(null, null);
        this._scrolledWin.set_min_content_width(Constants.VIEW_MIN);
        this._scrolledWin.set_min_content_height(Constants.VIEW_MIN);
        this._scrolledWin.add(this._view);
        this._scrolledWin.show();

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._actor.set_reactive(true);

        return this._actor;
    },

    _onDocumentLoaded : function() {
        this._document = this._pdfLoader.document;
        this._model = EvView.DocumentModel.new_with_document(this._document);

        this._model.set_sizing_mode(EvView.SizingMode.FIT_WIDTH);
	this._model.set_continuous(true);

        this._view.set_model(this._model);

        let pageSize = this._pdfLoader.get_max_page_size();
        this._pageWidth = Math.floor(pageSize[0]);
        this._pageHeight = Math.floor(pageSize[1]);

        this._mainWindow.refreshSize();
    },

    getSizeForAllocation : function(allocation) {
        let width = this._pageWidth + PDF_X_PADDING;
        let height = this._pageHeight;

        if (!this._document) {
            let swSize = this._scrolledWin.get_preferred_size()[1];
            width = swSize.width;
            height = swSize.height;
        } else {
            let scaledSize = Utils.getScaledSize([ width, height ],
                                                 allocation,
                                                 true);

            [ width, height ] = scaledSize;
        }

        return [ Math.floor(width), Math.floor(height) ];
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
        this._toolbarActor.set_size(38, 38);

        return this._toolbarActor;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new EvinceRenderer();

handler.registerMime("application/pdf", renderer);