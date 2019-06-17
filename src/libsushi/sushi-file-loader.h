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

#ifndef __SUSHI_FILE_LOADER_H__
#define __SUSHI_FILE_LOADER_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_FILE_LOADER sushi_file_loader_get_type ()
G_DECLARE_FINAL_TYPE (SushiFileLoader, sushi_file_loader, SUSHI, FILE_LOADER, GObject)

SushiFileLoader *sushi_file_loader_new (GFile *file);

gchar *sushi_file_loader_get_display_name (SushiFileLoader *self);
gchar *sushi_file_loader_get_size_string  (SushiFileLoader *self);
gchar *sushi_file_loader_get_date_string  (SushiFileLoader *self);
gchar *sushi_file_loader_get_content_type_string (SushiFileLoader *self);
GIcon *sushi_file_loader_get_icon     (SushiFileLoader *self);
GFileType sushi_file_loader_get_file_type (SushiFileLoader *self);

gboolean sushi_file_loader_get_loading (SushiFileLoader *self);

void sushi_file_loader_stop (SushiFileLoader *self);

G_END_DECLS

#endif /* __SUSHI_FILE_LOADER_H__ */
