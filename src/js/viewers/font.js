let MimeHandler = imports.ui.mimeHandler;
let GtkClutter = imports.gi.GtkClutter;
let Gtk = imports.gi.Gtk;
let GLib = imports.gi.GLib;

let Sushi = imports.gi.Sushi;

function FontRenderer(args) {
    this._init(args);
}

FontRenderer.prototype = {
    _init : function(args) {
        this.moveOnClick = true;
        this.canFullScreen = false;
    },

    render : function(file, mainWindow) {
        this._fontWidget = new Sushi.FontWidget({ uri: file.get_uri() });
        this._fontWidget.show();

        this._fontWidget.connect
        ("loaded",
         Lang.bind (this,
                    function() {
                        if (this._fontWidget.get_realized())
                            mainWindow.refreshSize();
                        else
                            this._fontWidget.connect("realize",
                                                     function() {
                                                         mainWindow.refreshSize();
                                                     })}));

        this._fontActor = new GtkClutter.Actor({ contents: this._fontWidget });

        return this._fontActor;
    },

    getSizeForAllocation : function(allocation) {
        let size = [ this._fontWidget.get_preferred_size()[1].width,
                     this._fontWidget.get_preferred_size()[1].height ];

        log ("allocation " + allocation[0] + " " + allocation[1] + " size " + size[0] + " " + size[1]);

        if (size[0] > allocation[0])
            size[0] = allocation[0];

        if (size[1] > allocation[1])
            size[1] = allocation[1];

        return size;
    }
}

let handler = new MimeHandler.MimeHandler();
let renderer = new FontRenderer();

handler.registerMime("application/x-font-ttf", renderer);
