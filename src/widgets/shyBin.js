// SPDX-License-Identifier: GPL-3.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: (c) 2023-2025 Sophie Herold

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Adapted from Loupe:
// <https://gitlab.gnome.org/GNOME/loupe/-/blob/6f7ef1c3b848ba3c7cbfa990d106a57417722146/src/widgets/shy_bin.rs>

/** A bin that only has min width as natural width.
 *  This bin does not claim its complete width as natural width. The HeaderBar
 *  is wrapped in with this widget. This prevents the window from growing based
 *  on a long file name in the title instead of just fitting to the renderer size. */
export class ShyBin extends Adw.Bin {
    static {
        GObject.registerClass(this);
    }

    constructor(constructProperties = {}) {
        super({...constructProperties, hexpand: true});

        this.set_layout_manager(null);
    }

    vfunc_measure(orientation, forSize) {
        const measurement = this.get_child().measure(orientation, forSize);
        if (orientation === Gtk.Orientation.HORIZONTAL)
            // Set natural size to minimal size
            measurement[1] = measurement[0];
        return measurement;
    }

    vfunc_size_allocate(width, height, baseline) {
        return this.get_child()?.allocate(width, height, baseline, null);
    }
}
