/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Renderer, ResizePolicy} from '../core/renderer.js';
const TotemMimeTypes = imports.util.totemMimeTypes;
import {ToolbarOverlay} from '../widgets/toolbarOverlay.js';

export const Klass = class VideoRenderer extends ToolbarOverlay {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/video.ui',
            Properties: {
                stream: GObject.ParamSpec.object(
                    'stream',
                    'Stream',
                    null,
                    GObject.ParamFlags.READABLE,
                    Gtk.MediaStream
                ),
            },
        }, this);
    }

    get stream() {
        return this._stream ?? null;
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super(constructProperties);

        this._stream = Gtk.MediaFile.new_for_file(file);
        this._stream.loop = true;
        this._stream.play();
        this.notify('stream');

        const preparedId = this._stream.connect('notify::prepared', () => {
            this._stream.disconnect(preparedId);
            this.isReady();
        });

        this.initialized();
    }

    stop() {
        this._stream.clear();
    }

    _togglePlay() {
        if (this._stream.get_playing())
            this._stream.pause();
        else
            this._stream.play();
    }

    _handleMediaClick(_, numClicks) {
        if (numClicks === 1) {
            this._togglePlay();
        } else if (numClicks === 2) {
            // reset play state from click === 1
            this._togglePlay();
            this.activate_action('win.fullscreen', null);
        }
    }

    get overlay() {
        return ResizePolicy.SCALED;
    }

    get resizePolicy() {
        return ResizePolicy.SCALED;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
};

export const mimeTypes = TotemMimeTypes.videoTypes;
