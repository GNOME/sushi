/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import GioUnix from 'gi://GioUnix';
import GObject from 'gi://GObject';
import PapersDocument from 'gi://PapersDocument';
import PapersView from 'gi://PapersView';
import Sushi from 'gi://Sushi';
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {Renderer} from '../core/renderer.js';
import {setupActions} from '../util/action.js';
import {Connection} from '../util/connection.js';

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

    #loadJobId = new Connection();
    #pageChangedId = new Connection();

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
        this.#loadJobId.disconnect();
        this.#pageChangedId.disconnect();
        this._job?.cancel();
        this._job = null;
    }

    get toolbar() {
        return this._toolbar;
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        this.#loadJobId.connect(
            this._job, 'finished',
            job => {
                this.#loadJobId.disconnect();
                if (this.cancellable.is_cancelled())
                    return;
                this._job = null;
                return this._onLoadJobFinished(job);
            }
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

        this.#pageChangedId.connect(
            this._model, 'page-changed',
            () => this._updatePageLabel(this._model)
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
