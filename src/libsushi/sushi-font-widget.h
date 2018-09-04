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

#ifndef __SUSHI_FONT_WIDGET_H__
#define __SUSHI_FONT_WIDGET_H__

#include <glib-object.h>
#include <gtk/gtk.h>
#include <cairo/cairo-ft.h>
#include <hb-ft.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_FONT_WIDGET (sushi_font_widget_get_type ())

G_DECLARE_FINAL_TYPE (SushiFontWidget, sushi_font_widget,
                      SUSHI, FONT_WIDGET,
                      GtkDrawingArea)

SushiFontWidget *sushi_font_widget_new (const gchar *uri, gint face_index);

FT_Face sushi_font_widget_get_ft_face (SushiFontWidget *self);

const gchar *sushi_font_widget_get_uri (SushiFontWidget *self);

void sushi_font_widget_load (SushiFontWidget *self);

G_END_DECLS

#endif /* __SUSHI_FONT_WIDGET_H__ */
