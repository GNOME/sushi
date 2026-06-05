/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

#ifndef __SUSHI_FONT_LOADER_H__
#define __SUSHI_FONT_LOADER_H__

#include <ft2build.h>
#include FT_FREETYPE_H
#include <gio/gio.h>

FT_Face sushi_new_ft_face_from_uri (FT_Library library,
                                    const gchar *uri,
                                    gint face_index,
                                    gchar **contents,
                                    GError **error);

void sushi_new_ft_face_from_uri_async (FT_Library library,
                                       const gchar *uri,
                                       gint face_index,
                                       GAsyncReadyCallback callback,
                                       gpointer user_data);

FT_Face sushi_new_ft_face_from_uri_finish (GAsyncResult *result,
                                           gchar **contents,
                                           GError **error);

gchar * sushi_get_font_name (FT_Face face,
                             gboolean short_form);

#endif /* __SUSHI_FONT_LOADER_H__ */
