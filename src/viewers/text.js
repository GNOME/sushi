/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GtkSource from 'gi://GtkSource';

import {Renderer} from '../core/renderer.js';

Gio._promisify(GtkSource.FileLoader.prototype, 'load_async', 'load_finish');

export const Klass = class TextRenderer extends Adw.Bin {
    static {
        GObject.type_ensure(GtkSource.View);
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/text.ui',
            InternalChildren: ['view'],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        const buffer = this._createBuffer(file, fileInfo);
        this._view.buffer = buffer;
        this._view.showLineNumbers = !!buffer.language;

        this.markReady();
    }

    _setStyle(adwStyleManager, buffer) {
        const sourceStyleManager = GtkSource.StyleSchemeManager.get_default();
        let scheme;
        if (adwStyleManager.dark)
            scheme = sourceStyleManager.get_scheme('Adwaita-dark');
        else
            scheme = sourceStyleManager.get_scheme('Adwaita');
        buffer.set_style_scheme(scheme);
    }

    _createBuffer(file, fileInfo) {
        const buffer = new GtkSource.Buffer();

        const adwStyleManager = Adw.StyleManager.get_default();
        adwStyleManager.connect_object(
            'notify::dark',
            () => this._setStyle(adwStyleManager, buffer),
            this, GObject.ConnectFlags.DEFAULT
        );
        this._setStyle(adwStyleManager, buffer);

        const langManager = GtkSource.LanguageManager.get_default();
        const language = langManager.guess_language(file.get_basename(),
            fileInfo.get_content_type());
        if (language)
            buffer.set_language(language);

        const sourceFile = new GtkSource.File({location: file});
        const loader = new GtkSource.FileLoader({
            buffer,
            file: sourceFile,
        });

        // using idle instead of default so that cancellation is
        // "reactive" for large files i.e. switching to a different renderer
        // and cancelling this one works in a reasonable time.
        loader
            .load_async(GLib.PRIORITY_DEFAULT_IDLE, this.cancellable, null)
            .catch(error => this.emit('error', error));

        return buffer;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
};

// register for generic text/plain so specific text types can be overwritten
export const contentTypes = [
    'text/plain',
];
