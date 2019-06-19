/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * sushi-media-bin.h
 * Based on ekn-media-bin.h from:
 * https://github.com/endlessm/eos-knowledge-lib/tree/master/lib/eosknowledgeprivate
 *
 * Copyright (C) 2016 Endless Mobile, Inc.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Juan Pablo Ugarte <ugarte@endlessm.com>
 *
 */

#pragma once

#include <gst/gst.h>
#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_MEDIA_BIN (sushi_media_bin_get_type ())
G_DECLARE_FINAL_TYPE (SushiMediaBin, sushi_media_bin, SUSHI, MEDIA_BIN, GtkBox)

GtkWidget     *sushi_media_bin_new                  (gboolean audio_mode);

const gchar   *sushi_media_bin_get_uri              (SushiMediaBin *self);
void           sushi_media_bin_set_uri              (SushiMediaBin *self,
                                                     const gchar *uri);

gdouble        sushi_media_bin_get_volume           (SushiMediaBin *self);
void           sushi_media_bin_set_volume           (SushiMediaBin *self,
                                                     gdouble      volume);

gint           sushi_media_bin_get_autohide_timeout (SushiMediaBin *self);
void           sushi_media_bin_set_autohide_timeout (SushiMediaBin *self,
                                                     gint         autohide_timeout);

gboolean       sushi_media_bin_get_fullscreen       (SushiMediaBin *self);
void           sushi_media_bin_set_fullscreen       (SushiMediaBin *self,
                                                     gboolean     fullscreen);

gboolean       sushi_media_bin_get_show_stream_info (SushiMediaBin *self);
void           sushi_media_bin_set_show_stream_info (SushiMediaBin *self,
                                                     gboolean     show_stream_info);

const gchar   *sushi_media_bin_get_title            (SushiMediaBin *self);
void           sushi_media_bin_set_title            (SushiMediaBin *self,
                                                     const gchar *title);

const gchar   *sushi_media_bin_get_description      (SushiMediaBin *self);
void           sushi_media_bin_set_description      (SushiMediaBin *self,
                                                     const gchar *description);

GstTagList    *sushi_media_bin_get_audio_tags       (SushiMediaBin *self);
GstTagList    *sushi_media_bin_get_video_tags       (SushiMediaBin *self);

void           sushi_media_bin_play                 (SushiMediaBin *self);
void           sushi_media_bin_pause                (SushiMediaBin *self);
void           sushi_media_bin_stop                 (SushiMediaBin *self);

GdkPixbuf     *sushi_media_bin_screenshot           (SushiMediaBin *self,
                                                     gint         width,
                                                     gint         height);

G_END_DECLS
