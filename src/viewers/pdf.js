/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GObject from 'gi://GObject';
import PapersDocument from 'gi://PapersDocument';
import PapersView from 'gi://PapersView';
import Sushi from 'gi://Sushi';
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {Renderer} from '../core/renderer.js';
import {setupActions} from '../util/action.js';

import * as Libreoffice from './libreoffice.js';

export const Klass = class PdfRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/pdf.ui',
            InternalChildren: [
                'model', 'view', 'toolbarBack', 'toolbarForward', 'pageLabel',
                'toolbar',
            ],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        GObject.type_ensure(PapersView.View);

        super(constructProperties);

        if (papersTypes.includes(fileInfo.get_content_type())) {
            this._loadFile(file);
        } else {
            Sushi.convert_libreoffice(file, this.cancellable, (o, res) => {
                let convertedFile;
                try {
                    convertedFile = Sushi.convert_libreoffice_finish(res);
                } catch (e) {
                    this.emit('error', e);
                    return;
                }

                this._loadFile(convertedFile);
            });
        }

        setupActions(this, 'pdf', [
            ['copy', () => this._view.copy()],
        ]);

        this.markInitialized();
    }

    stop() {
        this._job?.cancel();
        this._job = null;
    }

    get toolbar() {
        return this._toolbar;
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        const loadJobID = this._job.connect_object(
            'finished',
            job => {
                if (this.cancellable.is_cancelled())
                    return;
                job.disconnect(loadJobID);
                this._job = null;
                return this._onLoadJobFinished(job);
            },
            this, GObject.ConnectFlags.DEFAULT
        );
        this._job.scheduler_push_job(PapersView.JobPriority.PRIORITY_NONE);
    }

    _onLoadJobFinished(job) {
        const document = job.get_loaded_document();
        try {
            // the original C function has an out param for the error
            // which gets converted to an exception by GJS.
            job.is_succeeded();
        } catch (error) {
            this.emit('error', error);
            return;
        }

        this._model.set_document(document);

        this._model.connect_object(
            'page-changed',
            () => this._updatePageLabel(this._model),
            this, GObject.ConnectFlags.DEFAULT
        );
        this._updatePageLabel(this._model);
        this.markReady();
    }

    _goNextPage() {
        this._view.next_page();
    }

    _goPreviousPage() {
        this._view.previous_page();
    }

    _updatePageLabel(model) {
        const currentPage = model.get_page();
        const totalPages = model.document.get_n_pages();

        this._toolbarBack.set_sensitive(currentPage > 0);
        this._toolbarForward.set_sensitive(currentPage < totalPages - 1);
        this._pageLabel.set_text(Format.vprintf(_('%d of %d'), [currentPage + 1, totalPages]));
        this._pageLabel.set_visible(true);
    }
};

PapersDocument.init();
const appInfo = GioUnix.DesktopAppInfo.new('org.gnome.Papers.desktop');
const papersTypes = appInfo.get_supported_types();
export const mimeTypes = Libreoffice.isAvailable()
    ? papersTypes
    : [...papersTypes, ...Libreoffice.officeTypes];
