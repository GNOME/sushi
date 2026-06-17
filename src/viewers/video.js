/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Renderer, ResizePolicy} from '../core/renderer.js';
const TotemMimeTypes = imports.util.totemMimeTypes;
import {ToolbarOverlay} from '../widgets/toolbarOverlay.js';

export const Klass = class VideoRenderer extends ToolbarOverlay {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Properties: {
                ready: GObject.ParamSpec.boolean('ready', '', '',
                                                 GObject.ParamFlags.READABLE,
                                                 false)
            },
        }, this);
    }

    get ready() {
        return !!this._ready;
    }

    _init(file) {
        super._init();

        this._stream = Gtk.MediaFile.new_for_file(file);
        this._stream.loop = true;
        this._stream.play();

        this._stream.connect('notify::prepared', () => {
            this.isReady();
        });

        this._picture = Gtk.Picture.new_for_paintable(this._stream);
        this.set_child(this._picture);

        this._media_controls = new Gtk.MediaControls({ media_stream: this._stream,
                                                       css_classes: ['osd-bin', 'osd'] });

        const revealer = new Gtk.Revealer({ valign: Gtk.Align.END,
                                            transition_type: Gtk.RevealerTransitionType.CROSSFADE,
                                            margin_bottom: 12,
                                            margin_start: 12,
                                            margin_end: 12,
                                            child: this._media_controls});
        this.add_overlay(revealer);

        this.connect('unmap', () => (this._stream.pause()));
    }

    get overlay() {
        return ResizePolicy.SCALED;
    }

    get resizePolicy() {
        return ResizePolicy.SCALED;
    }
};

export const mimeTypes = TotemMimeTypes.videoTypes;
