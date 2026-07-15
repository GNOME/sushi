/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Renderer, ResizePolicy} from 'resource:///org/gnome/NautilusPreviewerDevel/js/core/renderer.js';

export const Klass = class ExampleRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        const statusPage = new Adw.StatusPage({
            title: 'Example',
            description: 'This is only a test',
        });
        const button = new Gtk.Button({
            halign: Gtk.Align.CENTER,
            label: 'OK',
            css_classes: ['pill'],
        });

        statusPage.set_child(button);
        this.set_child(statusPage);

        this.isReady();
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }
};

export const mimeTypes = [
    'your/filetype',
];
