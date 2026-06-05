/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
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
