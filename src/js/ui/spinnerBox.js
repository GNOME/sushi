let Clutter = imports.gi.Clutter;
let Gtk = imports.gi.Gtk;

let Tweener = imports.ui.tweener;
let Mainloop = imports.mainloop;

let SPINNER_SIZE = 48;
let TIMEOUT = 500;

function SpinnerBox(args) {
    this._init(args);
    this.canFullScreen = false;
    this.moveOnClick = true;
}

SpinnerBox.prototype = {
    _init : function(args) {
        this._spinnerBox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 12);
        this._spinnerBox.show();

        this._spinner = Gtk.Spinner.new();
        this._spinner.show();
        this._spinner.set_size_request(SPINNER_SIZE, SPINNER_SIZE);
        this._spinnerBox.pack_start(this._spinner, true, true, 0);

        this._label = new Gtk.Label();
        this._label.set_text(_("Loading..."));
        this._label.show();
        this._spinnerBox.pack_start(this._label, true, true, 0);

        this.actor = new GtkClutter.Actor({ contents: this._spinnerBox });
        this.actor.set_opacity(0);
    },

    render : function() {
        return this.actor;
    },

    getSizeForAllocation : function() {
        let spinnerSize = this._spinnerBox.get_preferred_size();
        return [ spinnerSize[0].width,
                 spinnerSize[0].height ];
    },

    startTimeout : function() {
        if (this._timeoutId)
            return;

        this._spinner.start();
        this._timeoutId = Mainloop.timeout_add(TIMEOUT,
                                               Lang.bind(this,
                                                         this._onTimeoutCompleted));
    },

    destroy : function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            delete this._timeoutId;
        }

        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: 0.15,
                           transition: 'easeOutQuad',
                           onComplete: function() {
                               this.actor.destroy();
                           },
                           onCompleteScope: this
                         });
    },

    _onTimeoutCompleted : function() {
        delete this._timeoutId;

        Tweener.addTween(this.actor,
                         { opacity: 255,
                           time: 0.3,
                           transition: 'easeOutQuad'
                         });
    },
}