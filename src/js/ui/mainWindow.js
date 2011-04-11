const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Clutter = imports.gi.Clutter;

const Cairo = imports.cairo;
const Tweener = imports.tweener.tweener;
const Lang = imports.lang;

const Mainloop = imports.mainloop;

const MimeHandler = imports.ui.mimeHandler;

const VIEW_MIN = 400;
const VIEW_PADDING_Y = 28;
const VIEW_PADDING_X = 4;
const VIEW_MAX_W = 800;
const VIEW_MAX_H = 600;

function MainWindow(args) {
    this._init(args);
}

MainWindow.prototype = {
    _init : function(args) {
        args = args || {};

        this._mimeHandler = new MimeHandler.MimeHandler();

        this._application = args.application;
        this._createGtkWindow();
        this._createClutterEmbed();

        this._connectStageSignals();
        this._createToolbar();
    },

    _createGtkWindow : function() {
        this._gtkWindow = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL,
                                           focusOnMap: true,
                                           decorated: false,
                                           hasResizeGrip: false,
                                           skipPagerHint: true,
                                           skipTaskbarHint: true});

        let screen = Gdk.Screen.get_default();
        this._gtkWindow.set_visual(screen.get_rgba_visual());

        this._gtkWindow.connect("delete-event",
                                Lang.bind(this, this._onWindowDeleteEvent));
    },

    _createClutterEmbed : function() {
        this._clutterEmbed = new GtkClutter.Embed();
        this._gtkWindow.add(this._clutterEmbed);

        this._clutterEmbed.set_receives_default(true);
        this._clutterEmbed.set_can_default(true);

        this._stage = this._clutterEmbed.get_stage();
        this._stage.set_use_alpha(true);
        this._stage.set_opacity(221);
        this._stage.set_color(new Clutter.Color({ red: 0,
                                                  green: 0,
                                                  blue: 0, 
                                                  alpha: 255 }));
        this._stage.set_size(VIEW_MIN, VIEW_MIN);
        this._gtkWindow.resize(VIEW_MIN, VIEW_MIN);
    },

    _connectStageSignals : function() {
        this._stage.connect("key-press-event",
                            Lang.bind(this, this._onStageKeyPressEvent));
        this._stage.connect("button-press-event",
                            Lang.bind(this, this._onButtonPressEvent));
        this._stage.connect("motion-event",
                            Lang.bind(this, this._onMotionEvent));
    },

    _createToolbar : function () {
        this._mainToolbar = new Gtk.Toolbar();
        this._mainToolbar.get_style_context().add_class("np-toolbar");
        this._mainToolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR);
        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });
        this._toolbarActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        let yConstraint = 
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: this._stage.height - 52 });
        this._toolbarActor.add_constraint(yConstraint);

        this._toolbarActor.set_size(100, 40);
        this._toolbarActor.set_opacity(0);
        this._stage.add_actor(this._toolbarActor);

        this._stage.connect("notify::height",
                            Lang.bind(this, function() {
                                yConstraint.set_offset(this._stage.height - 52);
                            }));

        this._toolbarNext = new Gtk.ToolButton();
        this._toolbarNext.set_icon_name("go-next-symbolic");
        this._toolbarNext.show();
        this._toolbarNext.set_expand(true);
        this._mainToolbar.insert(this._toolbarNext, 0);

        this._toolbarZoom = new Gtk.ToolButton();
        this._toolbarZoom.set_icon_name("view-fullscreen-symbolic");
        this._toolbarZoom.set_expand(true);
        this._toolbarZoom.show();
        this._mainToolbar.insert(this._toolbarZoom, 0);

        this._isFullscreen = false;
        this._toolbarZoom.connect("clicked",
                                  Lang.bind(this, this._toggleFullScreen));

        this._toolbarPrev = new Gtk.ToolButton();
        this._toolbarPrev.set_icon_name("go-previous-symbolic");
        this._toolbarPrev.set_expand(true);
        this._toolbarPrev.show();
        this._mainToolbar.insert(this._toolbarPrev, 0);
    },

    _onWindowDeleteEvent : function() {
        this._application.quit();
    },

    _onStageKeyPressEvent : function(actor, event) {
        let key = event.get_key_symbol();

        if (key == Clutter.Escape)
            this._application.quit();
    },

    _toggleFullScreen : function() {
        /* FIXME: this doesn't work well, but I don't really understand why...*/
        if(this._isFullScreen) {
            this._isFullScreen = false;
            this._positionTexture();
            this._gtkWindow.unfullscreen();
        } else {
            this._isFullScreen = true;
            this._positionTexture();
            this._gtkWindow.fullscreen();
        }
    },

    _positionTexture : function() {
        let yFactor = 0;
        let screen_size = [ this._gtkWindow.get_screen().get_width(),
                            this._gtkWindow.get_screen().get_height() ];
        let base_size = this._texture.get_base_size();

        let maxW = this._isFullScreen ?
            screen_size[0] : VIEW_MAX_W;
        let maxH = this._isFullScreen ?
            screen_size[1] : VIEW_MAX_H;

        let width = base_size[0];
        let height = base_size[1];

        this._texture.clear_constraints();

        if(width > maxW || height > maxH) {
            let scale = 0;

            if (width > height)
                scale = maxW / width;
            else
                scale = maxH / height;

            this._texture.set_size(width * scale,
                                   height * scale);
            this._gtkWindow.resize(this._texture.width + VIEW_PADDING_X,
                                   this._texture.height + VIEW_PADDING_Y);
        } else if (width < VIEW_MIN &&
                   height < VIEW_MIN) {
            this._gtkWindow.resize(VIEW_MIN + VIEW_PADDING_X,
                                   VIEW_MIN + VIEW_PADDING_Y);
            yFactor = 0.52;
        } else {
            this._gtkWindow.resize(width + VIEW_PADDING_X,
                                   height + VIEW_PADDING_Y);
        }

        this._texture.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));

        if (yFactor == 0) {
            if (this._isFullScreen)
                yFactor = 0.52;
            else        
                yFactor = 0.92;
        }

        let yAlign =                 
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: yFactor })
        yAlign.set_align_axis(Clutter.AlignAxis.Y_AXIS);
        this._texture.add_constraint(yAlign);
    },

    showAll : function() {
        this._gtkWindow.show_all();
    },

    setFile : function(file) {
        if (this._texture)
            this._texture.destroy();

        this._texture = this._mimeHandler.getObject("image/png").render(file);

        this._positionTexture();
        this._stage.add_actor(this._texture);

        this._createTitle(file);
    },

    _createTitle : function(file) {
        if (this._titleLabel) {
            this._titleLabel.set_label(file.get_basename());
            return;
        }

        this._titleLabel = new Gtk.Label({ label: file.get_basename() });
        this._titleLabel.get_style_context().add_class("np-decoration");
        
        this._titleLabel.show();
        let actor = new GtkClutter.Actor({ contents: this._titleLabel });
        actor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 0.5 }));
        actor.add_constraint(
            new Clutter.BindConstraint({ source: this._stage,
                                         coordinate: Clutter.BindCoordinate.Y,
                                         offset: 3 }));

        this._stage.add_actor(actor);

        this._quitButton = 
            new Gtk.Button({ image: new Gtk.Image ({ "icon-size": Gtk.IconSize.MENU,
                                                     "icon-name": "window-close-symbolic" })});
        this._quitButton.get_style_context().add_class("np-decoration");
        this._quitButton.show();

        this._quitButton.connect("clicked",
                                 Lang.bind(this._application,
                                           this._application.quit));

        this._quitActor = new GtkClutter.Actor({ contents: this._quitButton });
        this._quitActor.add_constraint(
            new Clutter.AlignConstraint({ source: this._stage,
                                          factor: 1.0 }));

        this._stage.add_actor(this._quitActor);
    },

    _eventOnActor : function(coords, actor) {
        let transformed_pos = actor.get_transformed_position();
        if (((coords[0] >= transformed_pos[0]) &&
             (coords[0] <= transformed_pos[0] + actor.get_width()) &&
             (coords[1] >= transformed_pos[1]) &&
             (coords[1] <= transformed_pos[1] + actor.get_height())))
            return true;

        return false;
    },

    _onButtonPressEvent : function(actor, event) {        
        let win_coords = event.get_coords();

        if ((this._toolbarId &&
             this._eventOnActor(win_coords, this._toolbarActor)) ||
            this._eventOnActor(win_coords, this._quitActor))
            return false;

        let root_coords = 
            this._gtkWindow.get_window().get_root_coords(win_coords[0],
                                                         win_coords[1]);

        this._gtkWindow.get_window().begin_move_drag(event.get_button(),
                                                     root_coords[0],
                                                     root_coords[1],
                                                     event.get_time());

        return true;
    },

    _onMotionEvent : function() {
        if (this._toolbarId) {
            GLib.source_remove(this._toolbarId);
            delete this._toolbarId;
        } else {
            Tweener.removeAllTweens(this._toolbarActor);

            this._toolbarActor.raise_top();
            this._toolbarActor.set_opacity(0);
            Tweener.addTween(this._toolbarActor,
                             { opacity: 200,
                               time: 0.1,
                               transition: 'easeOutQuad',
                             });
        }

        this._toolbarId = Mainloop.timeout_add(1500,
                                               Lang.bind(this,
                                                         this._onToolbarTimeout));

        return true;
    },

    _onToolbarTimeout : function() {
        delete this._toolbarId;
        Tweener.addTween(this._toolbarActor,
                         { opacity: 0,
                           time: 0.25,
                           transition: 'easeOutQuad'
                         });
        return false;
    }
}