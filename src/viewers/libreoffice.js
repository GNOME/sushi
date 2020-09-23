const {GLib, GObject, Gtk} = imports.gi;

var LOKDocView;
try {
    LOKDocView = imports.gi.LOKDocView;
} catch(e) {
}

var isAvailable = function() {
    return LOKDocView !== undefined;
};

const Constants = imports.util.constants;
const Renderer = imports.ui.renderer;

var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class LibreofficeRenderer extends Gtk.ScrolledWindow {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file) {
        super._init({ hexpand: true,
                      visible: true,
                      min_content_height: Constants.VIEW_MIN,
                      min_content_width: Constants.VIEW_MIN });

        this._lastAllocWidth = 0;
        this._tickCallbackId = 0;

        this._view = LOKDocView.View.new(null, null);
        this._view.set_edit(false);
        this._view.show();
        this.add(this._view);

        this._view.open_document(file.get_uri(), '{}', null, null);
        this.isReady();
    }

    vfunc_size_allocate(allocation) {
        super.vfunc_size_allocate(allocation);

        if (this._view.width_request == -1)
            return;

        if (this._tickCallbackId != 0)
            this.remove_tick_callback(this._tickCallbackId);
        this._tickCallbackId = this.add_tick_callback(this._resizeView.bind(this));
    }

    _resizeView() {
        this._tickCallbackId = 0;

        let allocWidth = this.get_allocated_width();
        if (this._lastAllocWidth == allocWidth)
            return;

        // Match the Evince renderer behavior and resize the document upon
        // receiving a new allocation.
        // We rely on the fact that LOKDocView always sets its size using
        // gtk_widget_set_size_request(), so we can know how much it will
        // scale to after we set a new zoom level.
        let zoomLevel = this._view.zoom_level;

        if (this._view.width_request < allocWidth) {
            while ((this._view.width_request < allocWidth) && this._view.can_zoom_in) {
                zoomLevel = this._view.zoom_level;
                this._view.zoom_level += 0.1;
            }
        } else if (this._view.width_request > allocWidth) {
            while ((this._view.width_request >= allocWidth) && this._view.can_zoom_out) {
                this._view.zoom_level -= 0.1;
                zoomLevel = this._view.zoom_level;
            }
        }

        this._view.zoom_level = zoomLevel;
        this._lastAllocWidth = allocWidth;
    }

    get moveOnClick() {
        return false;
    }
});

var officeTypes = [
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/rtf'
];

var mimeTypes = [];
if (isAvailable())
    mimeTypes = officeTypes;
