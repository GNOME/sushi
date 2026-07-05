/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GtkSource from 'gi://GtkSource';

import {Renderer} from '../core/renderer.js';

export const Klass = class TextRenderer extends Gtk.ScrolledWindow {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        this.cancellable = new Gio.Cancellable();

        let buffer = this._createBuffer(file, fileInfo);
        this._view = new GtkSource.View({
            buffer,
            editable: false,
            cursor_visible: false,
            monospace: true,
            left_margin: 12,
            right_margin: 12,
            top_margin: 12,
            bottom_margin: 12,
            show_line_numbers: !!buffer.language,
        });

        this.set_child(this._view);

        this.isReady();
    }

    _setStyle(adwStyleManager, buffer) {
        let sourceStyleManager = GtkSource.StyleSchemeManager.get_default();
        let scheme;
        if (adwStyleManager.dark)
            scheme = sourceStyleManager.get_scheme('Adwaita-dark');
        else
            scheme = sourceStyleManager.get_scheme('Adwaita');
        buffer.set_style_scheme(scheme);
    }

    _createBuffer(file, fileInfo) {
        let buffer = new GtkSource.Buffer();

        let adwStyleManager = Adw.StyleManager.get_default();
        adwStyleManager.connect('notify::dark', () => {
            this._setStyle(adwStyleManager, buffer);
        });
        this._setStyle(adwStyleManager, buffer);

        let langManager = GtkSource.LanguageManager.get_default();
        let language = langManager.guess_language(file.get_basename(),
            fileInfo.get_content_type());
        if (language)
            buffer.set_language(language);

        let sourceFile = new GtkSource.File({location: file});
        let loader = new GtkSource.FileLoader({
            buffer,
            file: sourceFile,
        });
        loader.load_async(0, this.cancellable, null, (loader, result) => {
            try {
                loader.load_finish(result);
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    this.emit('error', e);
            }
        });

        return buffer;
    }
};

// register for text/plain and let the mime handler call us for child types
export const mimeTypes = [
    'text/plain',
];
