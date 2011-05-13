let MimeHandler = imports.ui.mimeHandler;
let EvDoc = imports.gi.EvinceDocument;
let EvView = imports.gi.EvinceView;

let Sushi = imports.gi.Sushi;

let Gettext = imports.gettext.domain("sushi");
let _ = Gettext.gettext;

let Utils = imports.ui.utils;
let Features = imports.util.features;

function EvinceRenderer(args) {
    this._init(args);
}

EvinceRenderer.prototype = {
    _init : function(args) {
        EvDoc.init();
        this.moveOnClick = false;
        this.canFullScreen = true;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        this._pdfLoader = new Sushi.PdfLoader();
        this._pdfLoader.connect("notify::document",
                                Lang.bind(this, this._onDocumentLoaded));
        this._pdfLoader.uri = file.get_uri();
    },

    render : function() {
        return this._actor;
    },

    _updatePageLabel : function() {
        let curPage, totPages;

        curPage = this._model.get_page();
        totPages = this._document.get_n_pages();

        this._toolbarBack.set_sensitive(curPage > 0);
        this._toolbarForward.set_sensitive(curPage < totPages - 1);
        
        this._pageLabel.set_text(_("%d of %d").format(curPage + 1, totPages));
    },

    _onDocumentLoaded : function() {
        this._document = this._pdfLoader.document;
        this._model = EvView.DocumentModel.new_with_document(this._document);

        this._model.set_sizing_mode(EvView.SizingMode.FIT_WIDTH);
	this._model.set_continuous(true);

        this._model.connect("page-changed",
                            Lang.bind(this, function() {
                                this._updatePageLabel();
                            }));

        this._view = EvView.View.new();
        this._view.show();

        this._scrolledWin = Gtk.ScrolledWindow.new(null, null);
        this._scrolledWin.set_min_content_width(Constants.VIEW_MIN);
        this._scrolledWin.set_min_content_height(Constants.VIEW_MIN);
        this._scrolledWin.show();

        this._view.set_model(this._model);
        this._scrolledWin.add(this._view);

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._actor.set_reactive(true);

        this._callback();
    },

    getSizeForAllocation : function(allocation) {
        /* always give the view the maximum possible allocation */
        return allocation;
    },

    _createLabelItem : function() {
        this._pageLabel = new Gtk.Label();
        this._pageLabel.set_margin_left(2);
        this._pageLabel.set_margin_right(2);

        let item = new Gtk.ToolItem();
        item.set_expand(true);
        item.add(this._pageLabel);
        item.show_all();

        return item;
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar({ "icon-size": Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_show_arrow(false);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });

        this._toolbarZoom = Utils.createFullScreenButton(this._mainWindow);
        this._mainToolbar.insert(this._toolbarZoom, 0);

        let separator = new Gtk.SeparatorToolItem();
        separator.show();
        this._mainToolbar.insert(separator, 1);

        this._toolbarBack = new Gtk.ToolButton({ expand: false,
                                                 "icon-name": "go-previous-symbolic" });
        this._toolbarBack.show();
        this._mainToolbar.insert(this._toolbarBack, 2);

        this._toolbarBack.connect("clicked",
                                  Lang.bind(this, function () {
                                      this._view.previous_page();
                                  }));

        let labelItem = this._createLabelItem();
        this._mainToolbar.insert(labelItem, 3);

        this._toolbarForward = new Gtk.ToolButton({ expand: false,
                                                 "icon-name": "go-next-symbolic" });
        this._toolbarForward.show();
        this._mainToolbar.insert(this._toolbarForward, 4);

        this._toolbarForward.connect("clicked",
                                     Lang.bind(this, function () {
                                         this._view.next_page();
                                     }));

        this._updatePageLabel();

        return this._toolbarActor;
    },

    clear : function() {
        this._pdfLoader.cleanup_document();
        delete this._document;
        delete this._pdfLoader;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new EvinceRenderer();

let mimeTypes = Sushi.query_supported_document_types();
handler.registerMimeTypes(mimeTypes, renderer);

if (Features.HAVE_UNOCONV) {
    let officeTypes = [
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.presentation",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/rtf"
    ];

    handler.registerMimeTypes(officeTypes, renderer);
}
