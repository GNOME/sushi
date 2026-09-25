/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gly from 'gi://Gly';
import GlyGtk4 from 'gi://GlyGtk4';
import GObject from 'gi://GObject';
import Gst from 'gi://Gst';
import GstTag from 'gi://GstTag';
import Gtk from 'gi://Gtk';
import Sushi from 'gi://Sushi';

import {setupActions} from '../util/action.js';
import {Renderer, ResizePolicy} from '../core/renderer.js';
import {CoverPaintable} from '../widgets/coverPaintable.js';
import {isCancelledError, isGLibError} from '../util/error.js';

Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');

const fetchCoverArt = (_file, _tagList, _cancellable) => {
    function _fetchFromTags(cancellable) {
        let coverSample = null;
        let idx = 0;

        while (true) {
            const [res, sample] = _tagList.get_sample_index(Gst.TAG_IMAGE, idx);
            if (!res)
                break;

            idx++;

            const caps = sample.get_caps();
            const capsStruct = caps.get_structure(0);
            const [, type] = capsStruct.get_enum('image-type', GstTag.TagImageType.$gtype);
            if (type === GstTag.TagImageType.UNDEFINED) {
                coverSample = sample;
            } else if (type === GstTag.TagImageType.FRONT_COVER) {
                coverSample = sample;
                break;
            }
        }

        // Fallback to preview
        if (!coverSample)
            coverSample = _tagList.get_sample_index(Gst.TAG_PREVIEW_IMAGE, 0)[1];

        if (coverSample)
            return _fetchFromGstSample(coverSample, cancellable);
        else
            return Promise.reject(new Error('No cover art tag'));
    }

    function _fetchFromFile(file, cancellable) {
        const loader = Gly.Loader.new(file);
        return loader.load_async(cancellable)
            .then(image => image.next_frame_async(cancellable))
            .then(frame => GlyGtk4.frame_get_texture(frame));
    }

    function _fetchFromGstSample(sample, cancellable) {
        const buffer = sample.get_buffer();
        const [ok, info] = buffer.map(Gst.MapFlags.READ);
        if (!ok)
            return Promise.reject(new Error('Failed to map GstBuffer'));
        const bytes = GLib.Bytes.new(info.data);
        const loader = Gly.Loader.new_for_bytes(bytes);
        return loader.load_async(cancellable)
            .then(image => image.next_frame_async(cancellable))
            .then(frame => GlyGtk4.frame_get_texture(frame));
    }

    function findCoverFiles(folder) {
        try {
            const regex = /(folder|cover|front)\.(jpg|jpeg|png)/;
            const flags = Gio.FileQueryInfoFlags.NONE;
            const enumerator = folder.enumerate_children('standard::name', flags, null);
            return [...enumerator]
                .filter(info => regex.test(info.get_name()))
                .map(info => enumerator.get_child(info));
        } catch (error) {
            if (isGLibError(error, Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return [];
            else
                throw error;
        }
    }

    async function fetchFromFolder() {
        const parent = _file.get_parent();
        const coverFiles = await findCoverFiles(parent);

        for (const coverFile of coverFiles) {
            try {
                return _fetchFromFile(coverFile, _cancellable);
            } catch {
                continue;
            }
        }

        return null;
    }

    return _fetchFromTags(_cancellable)
        .catch(error => {
            if (!isCancelledError(error))
                return fetchFromFolder();
        });
};

export const Klass = class AudioRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/audio.ui',
            InternalChildren: ['statusPage', 'mediaControls'],
        }, this);
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super(constructProperties);

        setupActions(this, 'audio', [
            ['play-pause', () => this.#togglePlay()],
        ]);

        this._stream = Gtk.MediaFile.new_for_file(file);
        this._stream.play();
        this._mediaControls.set_media_stream(this._stream);

        this._coverFetched = false;

        this._coverPaintable = new CoverPaintable({display: this.get_display()});
        this.bind_property(
            'scale-factor',
            this._coverPaintable,
            'scale-factor',
            GObject.BindingFlags.SYNC_CREATE);

        this._statusPage.set_paintable(this._coverPaintable);

        const disco = Sushi.Discoverer.new(file.get_uri());
        disco.connect_object(
            'tags-changed',
            () => {
                const tag_list = disco.get_tag_list();
                if (tag_list)
                    this._updateFromTags(tag_list);
            },
            this, GObject.ConnectFlags.DEFAULT
        );

        this.markReady();
    }

    stop() {
        this._stream.clear();
        this._coverPaintable.destroy();
    }

    #togglePlay() {
        if (this._stream.get_playing())
            this._stream.pause();
        else
            this._stream.play();
    }

    _updateFromTags(tags) {
        const albumName = tags.get_string('album')[1];
        const artistName = tags.get_string('artist')[1];
        const file = Gio.file_new_for_uri(this._stream.file.get_uri());
        const titleName = tags.get_string('title')[1] ?? file.get_basename();
        let description = '';

        if (artistName) {
            const escaped = GLib.markup_escape_text(artistName, -1);
            description += `<i>${_('by')}  </i><b>${escaped}</b>\n`;
        }

        if (albumName) {
            const escaped = GLib.markup_escape_text(albumName, -1);
            description += `<i>${_('from')}  </i>${escaped}`;
        }

        this._statusPage.set_title(titleName);
        this._statusPage.set_description(description);

        if (!this._coverFetched) {
            this._coverFetched = true;
            fetchCoverArt(file, tags, this.cancellable)
                .then(cover => {
                    this._coverPaintable.texture = cover;
                })
                .catch(error => {
                    if (!isGLibError(error, Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND) &&
                        !isCancelledError(error))
                        console.warn(error, 'Unable to fetch cover art');
                });
        }
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }
};

export const supportsContentType = contentType => {
    const iconName = Gio.content_type_get_generic_icon_name(contentType);
    return iconName === 'audio-x-generic';
};
