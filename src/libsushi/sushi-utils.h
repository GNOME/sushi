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

#ifndef __SUSHI_UTILS_H__
#define __SUSHI_UTILS_H__

#include <evince-document.h>
#include <evince-view.h>
#include <gdk/gdk.h>
#include <gio/gio.h>
#include <gst/gst.h>

G_BEGIN_DECLS

gchar **       sushi_query_supported_document_types (void);

EvDocument *   sushi_get_evince_document_from_job (EvJob   *job,
                                                   GError **error);

void           sushi_convert_libreoffice (GFile *file,
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

GdkPixbuf *    sushi_pixbuf_from_gst_sample (GstSample *sample,
                                             GError   **error);

void           sushi_window_set_child_of_external (GtkWindow *window,
                                                   const char *handle);
gboolean       sushi_running_under_wayland (GdkDisplay *display);

G_END_DECLS

#endif /* __SUSHI_UTILS_H__ */
