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

const {Gio, GLib, GObject, Gtk, Pango} = imports.gi;
const Gettext = imports.gettext;

const Renderer = imports.ui.renderer;

function _getDeepCountAttrs() {
    return [
        Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
        Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
        Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
        Gio.FILE_ATTRIBUTE_STANDARD_NAME,
        Gio.FILE_ATTRIBUTE_UNIX_INODE
    ].join(',');
}

const loadFile = function(_fileToLoad, _fileInfo, _cancellable, _updateCallback) {
    let _seenInodes = new Set();
    let _subDirectories = [];
    let _enumerator = null;
    let _file = null;

    let _state = { fileInfo: _fileInfo,
                   directoryItems: 0,
                   fileItems: 0,
                   loading: true,
                   totalItems: 0,
                   totalSize: 0,
                   unreadableItems: 0 }
    let _timeoutId = 0;

    function _cleanup() {
        if (_enumerator && !_enumerator.is_closed())
            _enumerator.close_async(0, null, null);
    }

    function _deepCountLoad() {
        _file.enumerate_children_async(
            _getDeepCountAttrs(), Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            GLib.PRIORITY_LOW, _cancellable,
            (f, res) => {
                try {
                    _enumerator = _file.enumerate_children_finish(res);
                } catch(e) {
                    _state.unreadableItems++;
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        _deepCountNext();
                    return;
                }

                _enumerator.next_files_async(
                    100, GLib.PRIORITY_LOW, _cancellable,
                    _deepCountMoreFiles);
            });
    }

    function _deepCountMoreFiles(en, res) {
        let files = [];
        try {
            files = _enumerator.next_files_finish(res);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
        }

        files.forEach(_deepCountOne);

        if (files.length) {
            _enumerator.next_files_async(
                100, GLib.PRIORITY_LOW, _cancellable,
                _deepCountMoreFiles);
        } else {
            _cleanup();
            _deepCountNext();
        }
    }

    function _deepCountNext() {
        _file = _subDirectories.shift();
        if (_file) {
            _deepCountLoad();
        } else {
            _cleanup();
            _state.loading = false;
        }

        _queueUpdate();
    }

    function _deepCountOne(info) {
        let inode = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_UNIX_INODE);
        let isSeen = false;
        if (inode) {
            isSeen = _seenInodes.has(inode);
            if (!isSeen)
                _seenInodes.add(inode);
        }

        let fileType = info.get_file_type();
        if (fileType == Gio.FileType.DIRECTORY) {
            _state.directoryItems++;
            _subDirectories.unshift(_file.get_child(info.get_name()));
        } else {
            _state.fileItems++;
        }

        if (!isSeen && info.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_SIZE))
            _state.totalSize += info.get_size();
    }

    function _queueUpdate() {
        if (_timeoutId != 0)
            return;

        _timeoutId = GLib.timeout_add(0, 300, () => {
            _timeoutId = 0;
            _sendUpdate();
            return false;
        });
    }

    function _unqueueUpdate() {
        if (_timeoutId != 0)
            GLib.source_remove(_timeoutId);
    }

    function _sendUpdate() {
        _updateCallback(_state);
    }

    _cancellable.connect(_unqueueUpdate);

    _file = _fileToLoad;
    let fileType = _fileInfo.get_file_type();
    if (fileType == Gio.FileType.DIRECTORY)
        _deepCountLoad();
    else
        _state.loading = false;

    _sendUpdate();
};

var FallbackRenderer = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class FallbackRenderer extends Gtk.Box {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file, fileInfo) {
        super._init({ orientation: Gtk.Orientation.HORIZONTAL,
                      spacing: 6 });

        this._image = new Gtk.Image();
        this.pack_start(this._image, false, false, 0);
        this._updateIcon(new Gio.ThemedIcon({ name: 'text-x-generic' }));

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 margin_top: 48,
                                 margin_start: 12,
                                 margin_end: 12 });
        this.pack_start(vbox, false, false, 0);

        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 spacing: 6 });
        vbox.pack_start(hbox, false, false, 0);

        this._titleLabel = new Gtk.Label({ max_width_chars: 48,
                                           ellipsize: Pango.EllipsizeMode.MIDDLE });
        this._titleLabel.set_halign(Gtk.Align.START);
        hbox.pack_start(this._titleLabel, false, false, 0);

        this._spinner = new Gtk.Spinner();
        hbox.pack_start(this._spinner, false, false, 0);
        this._spinner.start();
        this._spinner.show();

        this._typeLabel = new Gtk.Label({ no_show_all: true });
        this._typeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._typeLabel, false, false, 0);

        this._sizeLabel = new Gtk.Label();
        this._sizeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._sizeLabel, false, false, 0);

        this._dateLabel = new Gtk.Label();
        this._dateLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._dateLabel, false, false, 0);

        this._cancellable = new Gio.Cancellable();
        loadFile(file, fileInfo, this._cancellable, this._onFileInfoUpdated.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));
        this.isReady();
    }

    _applyLabels(state) {
        let fileName = state.fileInfo.get_display_name();
        fileName = GLib.markup_escape_text(fileName, -1);
        let titleStr = `<b><big>${fileName}</big></b>`;
        this._titleLabel.set_markup(titleStr);

        if (state.fileInfo.get_file_type() != Gio.FileType.DIRECTORY) {
            let contentType = state.fileInfo.get_content_type();
            let typeDescr = Gio.content_type_get_description(contentType);
            typeDescr = GLib.markup_escape_text(typeDescr, -1);
            let typeStr = '<small><b>' + _("Type") + '  </b>' + typeDescr + '</small>';
            this._typeLabel.set_markup(typeStr);
            this._typeLabel.show();
        }

        let sizeFormatted;
        if (state.fileInfo.get_file_type() != Gio.FileType.DIRECTORY) {
            sizeFormatted = GLib.format_size(state.fileInfo.get_size());
        } else if (state.totalSize > 0) {
            let itemsStr = Gettext.ngettext(
                "%d item", "%d items",
                state.fileItems + state.directoryItems).
                format(state.fileItems + state.directoryItems);
            sizeFormatted = `${GLib.format_size(state.totalSize)}, ${itemsStr}`;
        } else {
            sizeFormatted = _("Empty Folder");
        }

        sizeFormatted = GLib.markup_escape_text(sizeFormatted, -1);
        let sizeStr = '<small><b>' + _("Size") + '  </b>' + sizeFormatted + '</small>';
        this._sizeLabel.set_markup(sizeStr);

        let date = GLib.DateTime.new_from_timeval_local(state.fileInfo.get_modification_time());
        let dateFormatted = date.format('%x %X');
        dateFormatted = GLib.markup_escape_text(dateFormatted, -1);
        let dateStr = '<small><b>' + _("Modified") + '  </b>' + dateFormatted + '</small>';
        this._dateLabel.set_markup(dateStr);
    }

    _applyIcon(state) {
        let icon = state.fileInfo.get_icon();
        this._updateIcon(icon);
    }

    _updateIcon(icon) {
        let iconTheme = Gtk.IconTheme.get_default();
        let iconInfo = iconTheme.lookup_by_gicon_for_scale(icon, 256,
            this._image.scale_factor, 0);
        if (!iconInfo)
            return;

        try {
            let surface = iconInfo.load_surface(this._image.get_window());
            this._image.surface = surface;
        } catch (e) {
            logError(e, `Error loading surface for icon ${icon.to_string()}`);
        }
    }

    _onFileInfoUpdated(state) {
        if (!state.loading) {
            this._spinner.stop();
            this._spinner.hide();
        }

        this._applyIcon(state);
        this._applyLabels(state);
    }

    _onDestroy() {
        this._cancellable.cancel();
    }

    get hasToolbar() {
        return false;
    }

    get resizable() {
        return false;
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.NAT_SIZE;
    }
});
