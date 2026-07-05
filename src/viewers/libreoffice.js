import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

let LOKDocView;
try {
    LOKDocView = (await import('gi://LOKDocView')).default;
} catch {
    /* ignored */
}

export const isAvailable = function() {
    return LOKDocView !== undefined;
};

import {Renderer} from '../core/renderer.js';

export const Klass = class LibreofficeRenderer extends Gtk.ScrolledWindow {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    _init(file) {
        // eslint-disable-next-line no-restricted-syntax
        super._init({ hexpand: true,
                      propagate_natural_height: true,
                      propagate_natural_width: true,
                      visible: true,
        });

        this._lastAllocWidth = 0;
        this._tickCallbackId = 0;

        this._view = LOKDocView.View.new(null, null);
        this._view.set_edit(false);
        this.add(this._view);

        this._view.open_document(file.get_uri(), '{}', null, null);
        this.isReady();
    }

    vfunc_size_allocate(allocation) {
        super.vfunc_size_allocate(allocation);

        if (this._view.width_request === -1)
            return;

        if (this._tickCallbackId !== 0)
            this.remove_tick_callback(this._tickCallbackId);
        this._tickCallbackId = this.add_tick_callback(this._resizeView.bind(this));
    }

    _resizeView() {
        this._tickCallbackId = 0;

        let allocWidth = this.get_allocated_width();
        if (this._lastAllocWidth === allocWidth)
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
};

export const officeTypes = [
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

export const mimeTypes = isAvailable() ? officeTypes : [];
