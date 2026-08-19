/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Renderer, ResizePolicy, setupActions} from 'resource://org/gnome/NautilusPreviewer/plugin-api-1.js';

export const Klass = class ExampleRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        setupActions(this, 'example', [
            ['some-action', () => this.#callback()],
        ]);

        const statusPage = new Adw.StatusPage({
            title: 'Example',
            description: 'This is only a test',
        });
        const button = new Gtk.Button({
            halign: Gtk.Align.CENTER,
            label: 'OK',
            action_name: 'example.some-action',
            css_classes: ['pill'],
        });

        statusPage.set_child(button);
        this.set_child(statusPage);

        this.markReady();
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }

    #callback() {
        print('test');
    }
};

export const contentTypes = [
    'your/filetype',
];
