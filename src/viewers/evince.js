/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import PapersDocument from 'gi://PapersDocument';
import PapersView from 'gi://PapersView';
import Sushi from 'gi://Sushi';

import {Renderer} from '../core/renderer.js';
import {ToolbarOverlay} from '../widgets/toolbarOverlay.js';

import * as Libreoffice from './libreoffice.js';

const createDocumentModel = () => {
    return new PapersView.DocumentModel({
        annotation_model: new PapersView.AnnotationModel(),
    });
};

const createView = (model) => {
    const view = new PapersView.View();
    view.set_model(model);

    const undoContext = new PapersView.UndoContext({
        document_model: model,
    });
    const annotationsContext = new PapersView.AnnotationsContext({
        document_model: model,
        undo_context: undoContext,
    });
    view.set_annotations_context(annotationsContext);

    const searchContext = new PapersView.SearchContext({
        document_model: model,
    });
    view.set_search_context(searchContext);

    return view;
};

export const Klass = class PapersRenderer extends ToolbarOverlay {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    _init(file, fileInfo) {
        super._init();
        this._model = createDocumentModel();
        this._view = createView(this._model);
        this.cancellable = new Gio.Cancellable();

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

        this._defineActions();

        const scrolledWindow = new Gtk.ScrolledWindow({ visible: true,
                                                        propagate_natural_height: true,
                                                        propagate_natural_width: true,
                                                        child: this._view});
        this.set_child(scrolledWindow);

        this._toolbar = new PdfNavigationOverlay(this._view);
        this.add_overlay(this._toolbar);

        this.connect('unmap', this._onDestroy.bind(this));

        this.isReady();
    }

    _onDestroy() {
        if (this._job && this._jobHandlerId > 0)
            this._job.disconnect(this._jobHandlerId);
        if (this._model && this._modelHandlerId > 0)
            this._model.disconnect(this._modelHandlerId);
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        this._jobHandlerId = this._job.connect('finished', this._onLoadJobFinished.bind(this));
        this._job.scheduler_push_job(PapersView.JobPriority.PRIORITY_NONE);
    }

    _onLoadJobFinished(job) {
        const document = job.get_loaded_document();
        try {
            // the original C function has an out param for the error
            // which gets converted to an exception by GJS.
            job.is_succeeded();
        } catch (e) {
            this.emit('error', e);
            return;
        }

        this._model.set_document(document);
        this._model.set_sizing_mode(PapersView.SizingMode.FIT_WIDTH);
        this._model.set_continuous(true);

        this._modelHandlerId = this._model.connect('page-changed', () => {
            this._toolbar._updatePageLabel(this._model);
        });
        this._toolbar._updatePageLabel(this._model);
    }

    _defineActions() {
        let application = Gio.Application.get_default ();
        let copyAction = new Gio.SimpleAction({ name: 'copy' });
        copyAction.connect ('activate', () => {
          this._view.copy();
        });
        application.set_accels_for_action ('evince.copy', ['<control>c']);
        let actionGroup = new Gio.SimpleActionGroup();
        actionGroup.add_action(copyAction);
        this.insert_action_group ('evince', actionGroup);
    }
};

PapersDocument.init();
const appInfo = GioUnix.DesktopAppInfo.new('org.gnome.Papers.desktop');
const papersTypes = appInfo.get_supported_types();
export const mimeTypes = Libreoffice.isAvailable()
    ? papersTypes
    : [...papersTypes, ...Libreoffice.officeTypes];

class PdfNavigationOverlay extends Gtk.Revealer {
    static {
        GObject.registerClass(this);
    }

    _init(view) {
        this._view = view;

        super._init({ valign: Gtk.Align.END,
                      halign: Gtk.Align.START,
                      hexpand: false,
                      reveal_child: true,
                      margin_bottom: 12,
                      margin_start: 12,
                      margin_end: 12,
                      transition_type: Gtk.RevealerTransitionType.CROSSFADE });

        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                  spacing: 6,
                                  css_classes: ['osd-bin', 'osd'] });

        this._toolbarBack = new Gtk.Button({ icon_name: 'go-previous-symbolic' });
        this._toolbarBack.connect('clicked', () => {
            this._view.previous_page();
        });
        box.append(this._toolbarBack);

        this._pageLabel = new Gtk.Label({ hexpand: true,
                                          margin_start: 10,
                                          margin_end: 10,
                                          css_classes: ['numeric'] });
        box.append(this._pageLabel);

        this._toolbarForward = new Gtk.Button({ icon_name: 'go-next-symbolic' });
        this._toolbarForward.connect('clicked',() => {
            this._view.next_page();
        });
        box.append(this._toolbarForward);

        this.set_child(box);
    }

    _updatePageLabel(model) {
        const currentPage = model.get_page();
        const totalPages = model.document.get_n_pages();

        this._toolbarBack.set_sensitive(currentPage > 0);
        this._toolbarForward.set_sensitive(currentPage < totalPages - 1);
        this._pageLabel.set_text(_("%d of %d").format(currentPage + 1, totalPages));
    }
}
