// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

/** @param {Gtk.Widget} widget object this group should be set up for
 *  @param {string} prefix to be used for actions
 *  @param {[string, () => void][]} actions list of [action_name, callback] tuples
 *  Sets up @actions on given @widget with @prefix prefix */
export const setupActions = (widget, prefix, actions) => {
    const group = new Gio.SimpleActionGroup();

    for (const [action_name, callback] of actions) {
        const action = new Gio.SimpleAction({name: action_name});
        action.connect_object('activate', callback, widget, GObject.ConnectFlags.DEFAULT);
        group.add_action(action);
    }

    widget.insert_action_group(prefix, group);
};
