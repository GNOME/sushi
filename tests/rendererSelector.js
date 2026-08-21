import Gio from 'gi://Gio';

import {resolveRelativePath} from '../js/core/renderer.js';

const VIEWERS_URI = resolveRelativePath(import.meta.url, '../js/viewers');

describe('builtin viewers', () => {
    it('exists only one viewer for each content type', async () => {
        const viewerUris = enumerateChildren(VIEWERS_URI);
        const viewers = await Promise.all(viewerUris.map(uri => import(uri)));
        const byContentType = groupViewersByContentType(viewers);
        const contentTypesWithMoreThanOneViewer = byContentType
            .filter(([_contentType, viewers]) => viewers.length >= 2)
            .map(([contentType, viewers]) => [contentType, viewers.map(v => v.Klass.name)]);
        expect(contentTypesWithMoreThanOneViewer).toEqual([]);
    });
});

/** @param {any[]} viewers */
const groupViewersByContentType = viewers => {
    const viewersAndContentTypes = viewers
        .filter(v => Object.hasOwn(v, 'contentTypes'))
        .flatMap(v => v.contentTypes.map(contentType => [v, contentType]));
    const groups = Object.groupBy(
        viewersAndContentTypes,
        ([_viewer, contentType]) => contentType);
    return Object.entries(groups)
        .map(([contentType, viewers]) => [contentType, viewers.map(([viewer]) => viewer)]);
};

/** @param {string} uri
 *  @returns {string[]} */
const enumerateChildren = uri => {
    const file = Gio.File.new_for_uri(uri);
    return [...file.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null)]
        .map(child => file.get_child(child.get_name()))
        .map(child => child.get_uri());
};
