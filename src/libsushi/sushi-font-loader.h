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
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#ifndef __SUSHI_FONT_LOADER_H__
#define __SUSHI_FONT_LOADER_H__

#include <ft2build.h>
#include FT_FREETYPE_H
#include <gio/gio.h>

FT_Face sushi_new_ft_face_from_uri (FT_Library library,
                                    const gchar *uri,
                                    gchar **contents,
                                    GError **error);

void sushi_new_ft_face_from_uri_async (FT_Library library,
                                       const gchar *uri,
                                       GAsyncReadyCallback callback,
                                       gpointer user_data);

FT_Face sushi_new_ft_face_from_uri_finish (GAsyncResult *result,
                                           gchar **contents,
                                           GError **error);

#endif /* __SUSHI_FONT_LOADER_H__ */
