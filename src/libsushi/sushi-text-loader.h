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

#ifndef __SUSHI_TEXT_LOADER_H__
#define __SUSHI_TEXT_LOADER_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_TEXT_LOADER            (sushi_text_loader_get_type ())
#define SUSHI_TEXT_LOADER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_TEXT_LOADER, SushiTextLoader))
#define SUSHI_IS_TEXT_LOADER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_TEXT_LOADER))
#define SUSHI_TEXT_LOADER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_TEXT_LOADER, SushiTextLoaderClass))
#define SUSHI_IS_TEXT_LOADER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_TEXT_LOADER))
#define SUSHI_TEXT_LOADER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_TEXT_LOADER, SushiTextLoaderClass))

typedef struct _SushiTextLoader          SushiTextLoader;
typedef struct _SushiTextLoaderPrivate   SushiTextLoaderPrivate;
typedef struct _SushiTextLoaderClass     SushiTextLoaderClass;

struct _SushiTextLoader
{
  GObject parent_instance;

  SushiTextLoaderPrivate *priv;
};

struct _SushiTextLoaderClass
{
  GObjectClass parent_class;
};

GType    sushi_text_loader_get_type     (void) G_GNUC_CONST;

SushiTextLoader *sushi_text_loader_new (const gchar *uri);

G_END_DECLS

#endif /* __SUSHI_TEXT_LOADER_H__ */
