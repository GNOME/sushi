/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

#ifndef __SUSHI_UTILS_H__
#define __SUSHI_UTILS_H__

#include <gdk/gdk.h>
#include <gio/gio.h>
#include <gobject/gobject.h>
#include <gst/gst.h>
#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_DISCOVERER (sushi_discoverer_get_type())
G_DECLARE_FINAL_TYPE (SushiDiscoverer, sushi_discoverer, SUSHI, DISCOVERER, GObject)

void           sushi_convert_libreoffice (GFile *file,
                                          GCancellable *cancellable,
                                          GAsyncReadyCallback callback,
                                          gpointer user_data);
GFile *        sushi_convert_libreoffice_finish (GAsyncResult *result,
                                                 GError **error);

void           sushi_get_asin_for_track (const gchar *artist,
                                         const gchar *album,
                                         GAsyncReadyCallback callback,
                                         gpointer user_data);
gchar *        sushi_get_asin_for_track_finish (GAsyncResult *result,
                                                GError **error);

void           sushi_window_set_child_of_external (GtkWindow *window,
                                                   const char *handle);
gboolean       sushi_running_under_wayland (GdkDisplay *display);

SushiDiscoverer * sushi_discoverer_new (const char *uri);
const GstTagList * sushi_discoverer_get_tag_list (SushiDiscoverer *self);

G_END_DECLS

#endif /* __SUSHI_UTILS_H__ */
