/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Renderer, ResizePolicy} from '../core/renderer.js';
const TotemMimeTypes = imports.util.totemMimeTypes;
const { ToolbarOverlay } = imports.widgets.toolbarOverlay;

export const Klass = class VideoRenderer extends ToolbarOverlay {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Properties: {
                fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                                      GObject.ParamFlags.READABLE,
                                                      false),
                ready: GObject.ParamSpec.boolean('ready', '', '',
                                                 GObject.ParamFlags.READABLE,
                                                 false)
            },
        }, this);
    }

    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
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

    get canFullscreen() {
        return true;
    }

    get resizePolicy() {
        return ResizePolicy.NAT_SIZE;
    }
};

export const mimeTypes = TotemMimeTypes.videoTypes;
