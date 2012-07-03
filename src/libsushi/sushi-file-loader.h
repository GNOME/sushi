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

#ifndef __SUSHI_FILE_LOADER_H__
#define __SUSHI_FILE_LOADER_H__

#include <glib-object.h>
#include <gio/gio.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_FILE_LOADER            (sushi_file_loader_get_type ())
#define SUSHI_FILE_LOADER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_FILE_LOADER, SushiFileLoader))
#define SUSHI_IS_FILE_LOADER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_FILE_LOADER))
#define SUSHI_FILE_LOADER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_FILE_LOADER, SushiFileLoaderClass))
#define SUSHI_IS_FILE_LOADER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_FILE_LOADER))
#define SUSHI_FILE_LOADER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_FILE_LOADER, SushiFileLoaderClass))

typedef struct _SushiFileLoader          SushiFileLoader;
typedef struct _SushiFileLoaderPrivate   SushiFileLoaderPrivate;
typedef struct _SushiFileLoaderClass     SushiFileLoaderClass;

struct _SushiFileLoader
{
  GObject parent_instance;

  SushiFileLoaderPrivate *priv;
};

struct _SushiFileLoaderClass
{
  GObjectClass parent_class;
};

GType    sushi_file_loader_get_type     (void) G_GNUC_CONST;

SushiFileLoader *sushi_file_loader_new (GFile *file);

gchar *sushi_file_loader_get_display_name (SushiFileLoader *self);
gchar *sushi_file_loader_get_size_string  (SushiFileLoader *self);
gchar *sushi_file_loader_get_date_string  (SushiFileLoader *self);
gchar *sushi_file_loader_get_content_type_string (SushiFileLoader *self);
GdkPixbuf *sushi_file_loader_get_icon     (SushiFileLoader *self);
GFileType sushi_file_loader_get_file_type (SushiFileLoader *self);

gboolean sushi_file_loader_get_loading (SushiFileLoader *self);

void sushi_file_loader_stop (SushiFileLoader *self);

G_END_DECLS

#endif /* __SUSHI_FILE_LOADER_H__ */
