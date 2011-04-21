const DBus = imports.dbus;
const Lang = imports.lang;

// util imports
const Path = imports.util.path;

// gi imports
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;

const MainWindow = imports.ui.mainWindow;

const _SUSHI_DBUS_PATH = '/org/gnome/NautilusPreviewer';

const SushiIface = {
    name: 'org.gnome.NautilusPreviewer',

    methods: [ { name: "activate",
                 inSignature: '',
                 outSignature: '' },
               { name: "ShowFile",
                 inSignature: 'siii',
                 outSignature: '' } ],

    signals: [],
    properties: []
};

function RemoteApplication(args) {
    this._init(args);
}

RemoteApplication.prototype = {
    _init : function(args) {
        DBus.session.proxifyObject(this,
                                   SushiIface.name,
                                   _SUSHI_DBUS_PATH);
    }
}

DBus.proxifyPrototype(RemoteApplication.prototype,
                      SushiIface);

function Application(args) {
    this._init(args);
}

Application.prototype = {
    _init : function(args) {
        DBus.session.acquire_name(SushiIface.name,
                                  DBus.SINGLE_INSTANCE,
                                  Lang.bind(this, this._onNameAcquired),
                                  Lang.bind(this, this._onNameNotAcquired));
    },

    _onNameAcquired : function() {
        DBus.session.exportObject(_SUSHI_DBUS_PATH, this);

        this._defineStyleAndThemes();
        this._createMainWindow();
    },

    _onNameNotAcquired : function() {
        let remoteApp = new RemoteApplication();
        remoteApp.activateRemote();

        this.quit();
    },

    _createMainWindow : function() {
        this._mainWindow =
            new MainWindow.MainWindow({ application: this });
    },

    _defineStyleAndThemes : function() {
        let provider = new Gtk.CssProvider();
        provider.load_from_path(Path.STYLE_DIR + "gtk-style.css");
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
                                                 provider,
                                                 600);
    },

    activate : function() {
    },

    ShowFile : function(uri, xid, x, y) {
        if (xid)
            this._mainWindow.setParent(xid, x, y);
        this._mainWindow.showAll();

        this._mainWindow.setFile(Gio.file_new_for_uri(uri));
    },

    quit : function() {
        Gtk.main_quit();
    }
}