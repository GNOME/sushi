function FallbackRenderer(args) {
    this._init(args);
}

FallbackRenderer.prototype = {
    _init: function(args) {
        this.moveOnClick = false;
    },

    render: function(file, mainWindow) {
        this._label = Gtk.Label.new("No viewer found for this file");
        this._label.show();
        this._labelActor = new GtkClutter.Actor({ contents: this._label });

        return this._labelActor;
    },

    getSizeForAllocation: function(allocation) {
        return [ 400, 400 ];
    },

    createToolbar: function() {
        return null;
    }
}