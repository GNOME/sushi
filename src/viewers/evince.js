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


const {PapersDocument, PapersView, Gio, GObject, Gtk, Sushi} = imports.gi;

const Constants = imports.util.constants;
const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

const Libreoffice = imports.viewers.libreoffice;

var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class PapersRenderer extends Gtk.ScrolledWindow {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file, fileInfo) {
        super._init({ visible: true,
                      min_content_height: Constants.VIEW_MIN,
                      min_content_width: Constants.VIEW_MIN });

        this._view = new PapersView.View();
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

        this.set_child(this._view);

        this.connect('unmap', this._onDestroy.bind(this));

        this.isReady();
    }

    _onDestroy() {
        if(this._job)
            this._job.disconnect(this._jobHandlerId);
        if(this._model)
            this._model.disconnect(this._modelHandlerId);
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        this._jobHandlerId = this._job.connect('finished', this._onLoadJobFinished.bind(this));
        this._job.scheduler_push_job(PapersView.JobPriority.PRIORITY_NONE);
    }

    _updatePageLabel() {
        this.toolbar;  // no op to make sure it's populated

        let curPage = this._model.get_page();
        let totPages = this._model.document.get_n_pages();

        this._toolbarBack.set_sensitive(curPage > 0);
        this._toolbarForward.set_sensitive(curPage < totPages - 1);

        this._pageLabel.set_text(_("%d of %d").format(curPage + 1, totPages));
    }

    _onLoadJobFinished(job) {
        let document;
        try {
            document = job.get_loaded_document();
        } catch (e) {
            this.emit('error', e);
            return;
        }

        this._model = PapersView.DocumentModel.new_with_document(document);
        this._model.set_sizing_mode(PapersView.SizingMode.FIT_WIDTH);
        this._model.set_continuous(true);
        this._view.set_model(this._model);

        this._modelHandlerId = this._model.connect('page-changed', this._updatePageLabel.bind(this));
        this._updatePageLabel();
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

    populateToolbar(toolbar) {
        this._toolbarBack = Utils.createToolButton(this, 'go-previous-symbolic', () => {
            this._view.previous_page();
        });
        toolbar.append(this._toolbarBack);

        this._pageLabel = new Gtk.Label({ hexpand: true,
                                          margin_start: 10,
                                          margin_end: 10 });
        toolbar.append(this._pageLabel);

        this._toolbarForward = Utils.createToolButton(this, 'go-next-symbolic', () => {
            this._view.next_page();
        });
        toolbar.append(this._toolbarForward);
    }
});

PapersDocument.init();
let app_info = Gio.DesktopAppInfo.new('org.gnome.Papers.desktop');
let papersTypes = app_info.get_supported_types();
var mimeTypes = papersTypes;
if (!Libreoffice.isAvailable())
    mimeTypes = mimeTypes.concat(Libreoffice.officeTypes);
