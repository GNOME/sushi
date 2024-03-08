/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * sushi-media-bin.c
 * Based on ekn-media-bin.c from:
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

#include "sushi-media-bin.h"
#include <gst/gst.h>
#include <gst/video/gstvideosink.h>
#include <gst/audio/gstaudiobasesink.h>
#include <epoxy/gl.h>

#ifdef DEBUG

#include <unistd.h>
#include <sys/types.h>
#include <sys/syscall.h>
#define WARN_IF_NOT_MAIN_THREAD if (getpid () != syscall (SYS_gettid)) g_warning ("%s %d not in main thread", __func__, __LINE__);

#endif

#define AUTOHIDE_TIMEOUT_DEFAULT 2  /* Controls autohide timeout in seconds */

#define INFO_N_COLUMNS           6  /* Number of info columns labels */

#define FPS_WINDOW_SIZE          2  /* Window size in seconds to calculate fps */

#define GET_STATE_TIMEOUT        GST_SECOND / G_GINT64_CONSTANT (10)

#define SMB_ICON_SIZE            GTK_ICON_SIZE_BUTTON

#define SMB_ICON_NAME_PLAY       "media-playback-start-symbolic"
#define SMB_ICON_NAME_PAUSE      "media-playback-pause-symbolic"
#define SMB_ICON_NAME_FULLSCREEN "view-fullscreen-symbolic"
#define SMB_ICON_NAME_RESTORE    "view-restore-symbolic"

#define SMB_INITIAL_STATE        GST_STATE_PAUSED

GST_DEBUG_CATEGORY_STATIC (sushi_media_bin_debug);
#define GST_CAT_DEFAULT sushi_media_bin_debug

struct _SushiMediaBin
{
  GtkBox parent;
};

typedef struct
{
  /* Properties */
  gchar   *uri;
  gint     autohide_timeout;
  gchar   *title;
  gchar   *description;

  /* Boolean properties */
  gboolean fullscreen:1;
  gboolean show_stream_info:1;
  gboolean audio_mode:1;

  /* We place extra flags here so the get squashed with the boolean properties */
  gboolean title_user_set:1;            /* True if the user set title property */
  gboolean description_user_set:1;      /* True if the user set description property */
  gboolean dump_dot_file:1;             /* True if GST_DEBUG_DUMP_DOT_DIR is set */
  gboolean ignore_adjustment_changes:1;

  /* Internal Widgets */
  GtkStack      *stack;
  GtkImage      *playback_image;
  GtkImage      *fullscreen_image;
  GtkAdjustment *playback_adjustment;
  GtkAdjustment *volume_adjustment;

  /* Internal Video Widgets */
  GtkWidget      *overlay;
  GtkWidget      *play_box;
  GtkScaleButton *volume_button;
  GtkWidget      *info_box;

  GtkLabel *title_label;
  GtkLabel *info_column_label[INFO_N_COLUMNS];
  GtkLabel *duration_label;
  GtkLabel *progress_duration_label;
  GtkLabel *progress_position_label;

  /* Thanks to GSK all the blitting will be done in GL */
  GtkRevealer *top_revealer;
  GtkRevealer *bottom_revealer;

  /* Internal Audio Widgets */
  GtkWidget      *audio_box;
  GtkScaleButton *audio_volume_button;
  GtkLabel       *audio_duration_label;
  GtkLabel       *audio_position_label;
  GtkImage       *audio_playback_image;

  /* Support Objects */
  GtkWidget *video_widget;      /* Created at runtime from sink */
  GtkWindow *fullscreen_window;
  GdkCursor *blank_cursor;
  GtkWidget *tmp_image;      /* FIXME: remove this once we can derive from GtkBin in Glade */

  /* Internal variables */
  guint timeout_id;          /* Autohide timeout source id */
  gint  timeout_count;       /* Autohide timeout count since last move event */

  guint  tick_id;           /* Widget frame clock tick callback (used to update UI) */
  gint64 tick_start;
  gint64 frames_window_start;
  guint  frames_window;     /* Frames "rendered" in the last FPS_WINDOW_SIZE seconds window */
  guint  frames_rendered;   /* Total frames "rendered" */
  GdkEventType pressed_button_type;

  gint video_width;
  gint video_height;

  /* Gst support */
  GstElement *play;          /* playbin element */
  GstElement *video_sink;    /* The video sink element used (glsinkbin or gtksink) */
  GstElement *vis_plugin;    /* The visualization plugin */
  GstBus     *bus;           /* playbin bus */
  GstBuffer  *last_buffer;

  GstTagList *audio_tags;
  GstTagList *video_tags;
  GstTagList *text_tags;

  GstQuery *position_query;  /* Used to query position more quicker */

  GstState state;            /* The desired state of the pipeline */
  gint64   duration;         /* Stream duration */
  guint    position;         /* Stream position in seconds */
} SushiMediaBinPrivate;

enum
{
  PROP_0,

  PROP_URI,
  PROP_VOLUME,
  PROP_AUTOHIDE_TIMEOUT,
  PROP_FULLSCREEN,
  PROP_SHOW_STREAM_INFO,
  PROP_AUDIO_MODE,
  PROP_TITLE,
  PROP_DESCRIPTION,
  N_PROPERTIES
};

enum
{
  ERROR,
  SIZE_CHANGE,
  TAGS_CHANGE,
  LAST_SIGNAL
};

static GParamSpec *properties[N_PROPERTIES];
static guint sushi_media_bin_signals[LAST_SIGNAL] = { 0 };

G_DEFINE_TYPE_WITH_PRIVATE (SushiMediaBin, sushi_media_bin, GTK_TYPE_BOX);

#define SMB_PRIVATE(d) ((SushiMediaBinPrivate *) sushi_media_bin_get_instance_private(d))

static void         sushi_media_bin_init_playbin (SushiMediaBin *self);
static void         sushi_media_bin_set_tick_enabled (SushiMediaBin *self,
                                                      gboolean enabled);
static GtkWindow   *sushi_media_bin_window_new (SushiMediaBin *self);
static const gchar *format_time (gint time);

static inline gint64
sushi_media_bin_get_position (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint64 position;

  if (!priv->play || !gst_element_query (priv->play, priv->position_query))
    return 0;

  gst_query_parse_position (priv->position_query, NULL, &position);

  return position;
}

static GstStateChangeReturn
sushi_media_bin_set_state (SushiMediaBin *self, GstState state)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  priv->state = state;
  return gst_element_set_state (priv->play, state);
}

/* Action handlers */
static void
sushi_media_bin_toggle_playback (SushiMediaBin *self)
{
  if (SMB_PRIVATE (self)->state == GST_STATE_PLAYING)
    sushi_media_bin_pause (self);
  else
    sushi_media_bin_play (self);
}

static void
sushi_media_bin_toggle_fullscreen (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  /* Do nothing in audio mode */
  if (priv->audio_mode)
    return;

  sushi_media_bin_set_fullscreen (self, !priv->fullscreen);
}

static void
sushi_media_bin_reveal_controls (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  gdk_window_set_cursor (gtk_widget_get_window (priv->overlay), NULL);

  /* We only show the top bar if there is something in the info labels */
  if (!g_str_equal (gtk_label_get_label (priv->title_label), "") ||
      !g_str_equal (gtk_label_get_label (priv->info_column_label[0]), "") ||
      !g_str_equal (gtk_label_get_label (priv->info_column_label[2]), "") ||
      !g_str_equal (gtk_label_get_label (priv->info_column_label[4]), ""))
    gtk_revealer_set_reveal_child (priv->top_revealer, TRUE);

  gtk_revealer_set_reveal_child (priv->bottom_revealer, TRUE);
}

static gboolean
revealer_timeout (gpointer data)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (data);
  GdkWindow *window;

  if (++priv->timeout_count < priv->autohide_timeout)
    return G_SOURCE_CONTINUE;
  
  window = gtk_widget_get_window (priv->overlay);
  
  if (window != NULL)
    gdk_window_set_cursor (window, priv->blank_cursor);

  gtk_revealer_set_reveal_child (priv->top_revealer, FALSE);
  gtk_revealer_set_reveal_child (priv->bottom_revealer, FALSE);

  priv->timeout_id = 0;

  return G_SOURCE_REMOVE;
}

static inline void
ensure_no_timeout(SushiMediaBinPrivate *priv)
{
  if (!priv->timeout_id)
    return;

  g_source_remove (priv->timeout_id);
  priv->timeout_id = 0;
}

static void
sushi_media_bin_revealer_timeout (SushiMediaBin *self, gboolean activate)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (activate)
    {
      /* Reset counter */
      priv->timeout_count = 0;

      if (!priv->timeout_id)
        priv->timeout_id = g_timeout_add_seconds (1, revealer_timeout, self);
    }
  else
   {
      GdkWindow *window = gtk_widget_get_window (priv->overlay);

      ensure_no_timeout (priv);

      if (window)
        gdk_window_set_cursor (window, NULL);
   }
}

static void
sushi_media_bin_action_toggle (SushiMediaBin *self, const gchar *action)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  g_return_if_fail (action != NULL);

  if (g_str_equal (action, "playback"))
    sushi_media_bin_toggle_playback (self);
  else if (g_str_equal (action, "fullscreen"))
    sushi_media_bin_toggle_fullscreen (self);
  else if (g_str_equal (action, "show-stream-info"))
    {
      sushi_media_bin_set_show_stream_info (self, !priv->show_stream_info);
      sushi_media_bin_reveal_controls (self);
    }
  else
    g_warning ("Ignoring unknown toggle action %s", action);
}

static void
sushi_media_bin_action_seek (SushiMediaBin *self, gint seconds)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint64 position = sushi_media_bin_get_position (self) + (seconds * GST_SECOND);

  gst_element_seek_simple (priv->play, GST_FORMAT_TIME,
                           GST_SEEK_FLAG_FLUSH |
                           GST_SEEK_FLAG_ACCURATE,
                           seconds ? CLAMP (position, 0, priv->duration) : 0);
}

/* Signals handlers */
static gboolean
on_overlay_button_press_event (GtkWidget   *widget,
                               GdkEvent    *event,
                               SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (event->button.button != GDK_BUTTON_PRIMARY)
    return FALSE;

  priv->pressed_button_type = event->type;
  return TRUE;
}

static gboolean
on_overlay_button_release_event (GtkWidget   *widget,
                                 GdkEvent    *event,
                                 SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (event->button.button != GDK_BUTTON_PRIMARY)
    return FALSE;

  if (priv->pressed_button_type == GDK_BUTTON_PRESS)
    {
      sushi_media_bin_toggle_playback (self);
    }
  else if (priv->pressed_button_type == GDK_2BUTTON_PRESS)
    {
      sushi_media_bin_toggle_fullscreen (self);
      sushi_media_bin_toggle_playback (self);
    }

  /* Reset state, since some widgets like GtkButton do not consume
   * the last button press release event
   */
  priv->pressed_button_type = GDK_NOTHING;

  return TRUE;
}

static gboolean
on_revealer_leave_notify_event (GtkWidget   *widget,
                                GdkEvent    *event,
                                SushiMediaBin *self)
{
  sushi_media_bin_revealer_timeout (self, TRUE);
  return FALSE;
}

static gboolean
on_revealer_motion_notify_event (GtkWidget   *widget,
                                 GdkEvent    *event,
                                 SushiMediaBin *self)
{
  /* Do not hide controls and restore pointer */
  sushi_media_bin_revealer_timeout (self, FALSE);

  return TRUE;
}

static gboolean
on_overlay_motion_notify_event (GtkWidget   *widget,
                                GdkEvent    *event,
                                SushiMediaBin *self)
{
  sushi_media_bin_reveal_controls (self);
  sushi_media_bin_revealer_timeout (self, TRUE);
  return FALSE;
}

static void
on_playback_adjustment_value_changed (GtkAdjustment *adjustment,
                                      SushiMediaBin   *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (priv->ignore_adjustment_changes)
    return;

  priv->position = gtk_adjustment_get_value (adjustment);

  gst_element_seek_simple (priv->play,
                           GST_FORMAT_TIME,
                           GST_SEEK_FLAG_ACCURATE |
                           GST_SEEK_FLAG_FLUSH,
                           priv->position * GST_SECOND);
}

static gchar *
on_progress_scale_format_value (GtkScale    *scale,
                                gdouble      value,
                                SushiMediaBin *self)
{
  /* FIXME: CSS padding does not work as expected, add some padding here */
  return g_strdup_printf ("  %s  ", format_time (value));
}

static void
on_volume_popup_show (GtkWidget *popup, SushiMediaBin *self)
{
  /* Do not hide controls */
  sushi_media_bin_revealer_timeout (self, FALSE);
}

static void
on_volume_popup_hide (GtkWidget *popup, SushiMediaBin *self)
{
  sushi_media_bin_revealer_timeout (self, TRUE);
}

static inline void
sushi_media_bin_update_state (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (priv->uri && priv->video_sink)
    {
      g_object_set (priv->play, "uri", priv->uri, NULL);
      gst_element_set_state (priv->play, priv->state);
    }
}

static GdkPixbuf *
sushi_media_bin_video_pixbuf_new (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint width, height, video_width, video_height, dx, dy;
  cairo_surface_t *surface;
  gdouble scale = 1.0;
  GdkPixbuf *pixbuf;
  cairo_t *cr;

  width = gtk_widget_get_allocated_width (GTK_WIDGET (self));
  height = gtk_widget_get_allocated_height (GTK_WIDGET (self));

  video_width = gtk_widget_get_allocated_width (priv->video_widget);
  video_height = gtk_widget_get_allocated_height (priv->video_widget);

  if ((width != video_width || height != video_height) &&
      priv->video_width && priv->video_height)
    {
      scale = MIN (width/(gdouble)priv->video_width, height/(gdouble)priv->video_height);

      dx = ABS (video_width - priv->video_width) * scale;
      dy = ABS (video_height - priv->video_height) * scale;
      width = video_width * scale;
      height = video_height * scale;
    }
  else
    dx = dy = 0;

  surface = cairo_image_surface_create (CAIRO_FORMAT_RGB24, width, height);
  cr = cairo_create (surface);

  if (scale != 1.0)
    cairo_scale (cr, scale, scale);

  gtk_widget_draw (priv->video_widget, cr);

  pixbuf = gdk_pixbuf_get_from_surface (surface, dx/2, dy/2, width-dx, height-dy);

  cairo_destroy (cr);
  cairo_surface_destroy (surface);

  return pixbuf;
}

static inline gboolean
sushi_media_bin_gl_check (GtkWidget *widget)
{
  static gsize gl_works = 0;

  if (g_once_init_enter (&gl_works))
    {
      GError *error = NULL;
      gsize works = 1;
      GdkGLContext *context;
      GdkWindow *window;

      if ((window  = gtk_widget_get_window (widget)) &&
           (context = gdk_window_create_gl_context (window, &error)))
        {
          const gchar *vendor, *renderer;

          gdk_gl_context_make_current (context);

          vendor   = (const gchar *) glGetString (GL_VENDOR);
          renderer = (const gchar *) glGetString (GL_RENDERER);

          GST_INFO ("GL Vendor: %s, renderer: %s", vendor, renderer);

          if (g_str_equal (vendor, "nouveau"))
            GST_WARNING ("nouveau is blacklisted, since sharing gl contexts in "
                         "multiple threads is not supported "
                         "and will eventually make it crash.");
          else if (g_strstr_len (renderer, -1, "Gallium") &&
                   g_strstr_len (renderer, -1, "llvmpipe"))
            GST_INFO ("Detected software GL rasterizer, falling back to gtksink");
          else
            works = 2;

          gdk_gl_context_clear_current ();
        }

        if (error)
          {
            GST_WARNING ("Could not window to create GL context, %s", error->message);
            g_error_free (error);
          }

      g_once_init_leave (&gl_works, works);
    }

  return (gl_works > 1);
}

static inline void
sushi_media_bin_init_video_sink (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GtkWidget *video_widget = NULL;
  GstElement *video_sink = NULL;

  if (priv->video_sink)
    return;

  if (priv->audio_mode)
    {
      video_sink = gst_element_factory_make ("fakesink", "SushiMediaBinNullSink");
      g_object_set (video_sink, "sync", TRUE, NULL);
      g_object_set (priv->play, "video-sink", video_sink, NULL);
      priv->video_sink = gst_object_ref_sink (video_sink);
      return;
    }

  if (sushi_media_bin_gl_check (GTK_WIDGET (self)))
    {
      video_sink = gst_element_factory_make ("glsinkbin", "SushiMediaBinGLVideoSink");

      if (video_sink)
        {
          GstElement *gtkglsink = gst_element_factory_make ("gtkglsink", NULL);

          if (gtkglsink)
            {
              GST_INFO ("Using gtkglsink");
              g_object_set (video_sink, "sink", gtkglsink, NULL);
              g_object_get (gtkglsink, "widget", &video_widget, NULL);
            }
          else
            {
              GST_WARNING ("Could not create gtkglsink");
              gst_object_replace ((GstObject**)&video_sink, NULL);
            }
        }
      else
        {
          GST_WARNING ("Could not create glsinkbin");
        }
    }

  /* Fallback to gtksink */
  if (!video_sink)
    {
      GST_INFO ("Falling back to gtksink");
      video_sink = gst_element_factory_make ("gtksink", NULL);
      g_object_get (video_sink, "widget", &video_widget, NULL);
    }

  /* We use a null sink as a last resort */
  if (video_sink && video_widget)
    {
      g_object_set (video_widget, "expand", TRUE, NULL);

      /* And pack it where we want the video to show up */
      gtk_container_add (GTK_CONTAINER (priv->overlay), video_widget);
      gtk_widget_show (video_widget);

      /* g_object_get() returns a new reference */
      priv->video_widget = video_widget;
    }
  else
    {
      GtkWidget *img = gtk_image_new_from_icon_name ("image-missing",
                                                     GTK_ICON_SIZE_DIALOG);

      GST_WARNING ("Could not get video widget from gtkglsink/gtksink, falling back to fakesink");

      g_object_unref (video_widget);
      gst_object_unref (video_sink);
      video_sink = gst_element_factory_make ("fakesink", "SushiMediaBinFakeSink");
      g_object_set (video_sink, "sync", TRUE, NULL);

      gtk_container_add (GTK_CONTAINER (priv->overlay), img);
      gtk_widget_show (img);

      /* FIXME: the overlay does not get motion and press events with this code path */
    }

  /* Setup playbin video sink */
  if (video_sink)
    {
      g_object_set (priv->play, "video-sink", video_sink, NULL);
      priv->video_sink = gst_object_ref_sink (video_sink);
    }
}

static inline void
sushi_media_bin_deinit_video_sink (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  /* Stop Playback to give gst a chance to cleanup its mess */
  if (priv->play)
    gst_element_set_state (priv->play, GST_STATE_NULL);

  /* Stop bus watch */
  if (priv->bus)
    {
      gst_bus_set_flushing (priv->bus, TRUE);
      gst_bus_remove_watch (priv->bus);
      gst_object_replace ((GstObject**)&priv->bus, NULL);
    }

  /* Unref video sink */
  gst_object_replace ((GstObject**)&priv->video_sink, NULL);

  /* Destroy video widget */
  g_clear_pointer (&priv->video_widget, gtk_widget_destroy);

  /* Unref playbin */
  gst_object_replace ((GstObject**)&priv->play, NULL);
}

static void
sushi_media_bin_fullscreen_apply (SushiMediaBin *self, gboolean fullscreen)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint64 position = -1;

  if ((fullscreen && priv->fullscreen_window) ||
      (!fullscreen && !priv->fullscreen_window))
    return;

  /*
   * To avoid flickering, this will make the widget pack an image with the last
   * frame in the container before reparenting the video widget in the
   * fullscreen window
   */
  if (!priv->tmp_image)
    {
      GdkPixbuf *pixbuf = sushi_media_bin_video_pixbuf_new (self);
      priv->tmp_image = gtk_image_new_from_pixbuf (pixbuf);
      g_object_set (priv->tmp_image, "expand", TRUE, NULL);
      g_object_unref (pixbuf);
    }

  /*
   * FIXME: GtkGstGLWidget does not support reparenting to a different toplevel
   * because the gl context is different and the pipeline does not know it
   * changes, so as a temporary workaround we simply reconstruct the whole
   * pipeline.
   *
   * See bug https://bugzilla.gnome.org/show_bug.cgi?id=775045
   */
  if ((priv->state == GST_STATE_PAUSED || priv->state == GST_STATE_PLAYING) &&
      g_strcmp0 (G_OBJECT_TYPE_NAME (priv->video_sink), "GstGLSinkBin") == 0)
    {
      /* NOTE: here we could set tmp_image to the content of the current sample
       * but it wont be updated until the main window is show at which point
       * we will see the old frame anyways.
       */
      position = sushi_media_bin_get_position (self);

      gtk_container_remove (GTK_CONTAINER (priv->overlay), priv->video_widget);
      sushi_media_bin_deinit_video_sink (self);
    }

  g_object_ref (priv->overlay);

  if (fullscreen)
    {
      priv->fullscreen_window = g_object_ref (sushi_media_bin_window_new (self));

      /* Reparent video widget in a fullscreen window */
      gtk_container_remove (GTK_CONTAINER (priv->stack), priv->overlay);

      /* Pack an image with the last frame inside the bin */
      gtk_container_add (GTK_CONTAINER (priv->stack), priv->tmp_image);
      gtk_widget_show (priv->tmp_image);
      gtk_stack_set_visible_child (GTK_STACK (priv->stack), priv->tmp_image);

      /* Pack video in the fullscreen window */
      gtk_container_add (GTK_CONTAINER (priv->fullscreen_window), priv->overlay);

      gtk_window_fullscreen (priv->fullscreen_window);
      gtk_window_present (priv->fullscreen_window);

      /* Hide cursor if controls are hidden */
      if (!gtk_revealer_get_reveal_child (priv->bottom_revealer))
        gdk_window_set_cursor (gtk_widget_get_window (GTK_WIDGET (priv->fullscreen_window)),
                               priv->blank_cursor);

      gtk_image_set_from_icon_name (priv->fullscreen_image, SMB_ICON_NAME_RESTORE, SMB_ICON_SIZE);
    }
  else
    {
      gtk_container_remove (GTK_CONTAINER (priv->stack), priv->tmp_image);
      priv->tmp_image = NULL;

      /* Reparent video widget back into ourselves */
      gtk_container_remove (GTK_CONTAINER (priv->fullscreen_window), priv->overlay);
      gtk_container_add (GTK_CONTAINER (priv->stack), priv->overlay);
      gtk_stack_set_visible_child (GTK_STACK (priv->stack), priv->overlay);

      gtk_widget_destroy (GTK_WIDGET (priv->fullscreen_window));
      g_clear_object (&priv->fullscreen_window);

      gtk_image_set_from_icon_name (priv->fullscreen_image, SMB_ICON_NAME_FULLSCREEN, SMB_ICON_SIZE);

      gtk_widget_grab_focus (GTK_WIDGET (self));
    }

  /*
   * FIXME: See bug https://bugzilla.gnome.org/show_bug.cgi?id=775045
   */
  if (priv->play == NULL)
    {
      sushi_media_bin_init_playbin (self);
      sushi_media_bin_init_video_sink (self);

      g_object_set (priv->play, "uri", priv->uri, NULL);

      /* Init new pipeline */
      gst_element_set_state (priv->play, GST_STATE_PAUSED);
      gst_element_get_state (priv->play, NULL, NULL, GET_STATE_TIMEOUT);

      /* Seek to position */
      gst_element_seek_simple (priv->play, GST_FORMAT_TIME,
                               GST_SEEK_FLAG_ACCURATE | GST_SEEK_FLAG_FLUSH,
                               position);
      gst_message_unref (gst_bus_pop_filtered (priv->bus, GST_MESSAGE_ASYNC_DONE));

      /* Resume playback */
      if (priv->state == GST_STATE_PLAYING)
        {
          gst_element_set_state (priv->play, GST_STATE_PLAYING);
          gst_element_get_state (priv->play, NULL, NULL, GET_STATE_TIMEOUT);
        }
    }

  g_object_unref (priv->overlay);
}

static void
on_sushi_media_bin_realize (GtkWidget *widget, SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  /* Create a blank_cursor */
  priv->blank_cursor = gdk_cursor_new_from_name (gtk_widget_get_display (widget),
                                                 "none");

  /* Create video sink */
  sushi_media_bin_init_video_sink (self);

  if (priv->fullscreen)
    sushi_media_bin_fullscreen_apply (self, TRUE);

  /* Make playbin show the first video frame if there is an URI */
  sushi_media_bin_update_state (self);

  /* Disconnect after initialization */
  g_signal_handlers_disconnect_by_func (widget, on_sushi_media_bin_realize, self);
}

static void
on_sushi_media_bin_unrealize (GtkWidget *widget, SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  /* Remove controls timeout */
  ensure_no_timeout (priv);

  /* Disconnect after completion */
  g_signal_handlers_disconnect_by_func (widget, on_sushi_media_bin_unrealize, self);
}

static gboolean
sushi_media_bin_error (SushiMediaBin *self, GError *error)
{
  /* TODO: properly present errors to the user */
  g_warning ("%s", error->message);
  return TRUE;
}

static void
sushi_media_bin_init_volume_button (SushiMediaBin    *self,
                                    GtkScaleButton *button,
                                    gboolean        stop_timeout)
{
  GtkWidget *popup = gtk_scale_button_get_popup (button);

  if (stop_timeout)
    {
      g_signal_connect (popup, "show", G_CALLBACK (on_volume_popup_show), self);
      g_signal_connect (popup, "hide", G_CALLBACK (on_volume_popup_hide), self);
    }

  gtk_style_context_add_class (gtk_widget_get_style_context (popup), "sushi-media-bin");
}

static void
sushi_media_bin_init_style (SushiMediaBin *self)
{
  static gsize style_initialized = 0;

  if (g_once_init_enter (&style_initialized))
    {
      GtkCssProvider *css_provider = gtk_css_provider_new ();

      gtk_css_provider_load_from_resource (css_provider, "/org/gnome/Sushi/libsushi/sushi-media-bin.css");
      gtk_style_context_add_provider_for_screen (gdk_screen_get_default (),
                                                 GTK_STYLE_PROVIDER (css_provider),
                                                 GTK_STYLE_PROVIDER_PRIORITY_APPLICATION-10);
      g_object_unref (css_provider);

      g_once_init_leave (&style_initialized, 1);
    }
}

static void
sushi_media_bin_init (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint i;

  gtk_widget_init_template (GTK_WIDGET (self));

  sushi_media_bin_init_style (self);

  priv->state = SMB_INITIAL_STATE;
  priv->autohide_timeout = AUTOHIDE_TIMEOUT_DEFAULT;
  priv->pressed_button_type = GDK_NOTHING;
  priv->dump_dot_file = (g_getenv ("GST_DEBUG_DUMP_DOT_DIR") != NULL);

  sushi_media_bin_init_playbin (self);

  /* Create info box column labels */
  for (i = 0; i < INFO_N_COLUMNS; i++)
    {
      GtkWidget *label = gtk_label_new ("");
      priv->info_column_label[i] = GTK_LABEL (label);
      gtk_container_add (GTK_CONTAINER (priv->info_box), label);
      gtk_widget_set_valign (label, GTK_ALIGN_START);
      gtk_widget_show (label);
    }

  /* Cache position query */
  priv->position_query = gst_query_new_position (GST_FORMAT_TIME);

  /* Make both buttons look the same */
  g_object_bind_property (priv->playback_image, "icon-name",
                          priv->audio_playback_image, "icon-name",
                          G_BINDING_SYNC_CREATE);

  sushi_media_bin_init_volume_button (self, priv->volume_button, TRUE);
  sushi_media_bin_init_volume_button (self, priv->audio_volume_button, FALSE);
}

static void
sushi_media_bin_dispose (GObject *object)
{
  SushiMediaBin *self = SUSHI_MEDIA_BIN (object);
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  /* Remove controls timeout */
  ensure_no_timeout (priv);

  /* Finalize gstreamer related objects */
  sushi_media_bin_deinit_video_sink (self);

  /* Destroy fullscreen window */
  if (priv->fullscreen_window)
    {
      gtk_widget_destroy (GTK_WIDGET (priv->fullscreen_window));
      g_clear_object (&priv->fullscreen_window);
    }

  /* Unref cursor */
  g_clear_object (&priv->blank_cursor);

  G_OBJECT_CLASS (sushi_media_bin_parent_class)->dispose (object);
}

static void
sushi_media_bin_finalize (GObject *object)
{
  SushiMediaBin *self = SUSHI_MEDIA_BIN (object);
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  ensure_no_timeout(priv);

  /* Clear position query */
  g_clear_pointer (&priv->position_query, gst_query_unref);

  /* Remove frame clock tick callback */
  sushi_media_bin_set_tick_enabled (self, FALSE);

  /* Clear tag lists */
  g_clear_pointer (&priv->audio_tags, gst_tag_list_unref);
  g_clear_pointer (&priv->video_tags, gst_tag_list_unref);
  g_clear_pointer (&priv->text_tags, gst_tag_list_unref);

  /* Free properties */
  g_clear_pointer (&priv->uri, g_free);
  g_clear_pointer (&priv->title, g_free);
  g_clear_pointer (&priv->description, g_free);

  G_OBJECT_CLASS (sushi_media_bin_parent_class)->finalize (object);
}

static inline void
sushi_media_bin_set_audio_mode (SushiMediaBin *self, gboolean audio_mode)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  priv->audio_mode = audio_mode;

  if (audio_mode)
    gtk_stack_set_visible_child (GTK_STACK (priv->stack), priv->audio_box);
}

static void
sushi_media_bin_set_property (GObject      *object,
                              guint         prop_id,
                              const GValue *value,
                              GParamSpec   *pspec)
{
  g_return_if_fail (SUSHI_IS_MEDIA_BIN (object));

  switch (prop_id)
    {
    case PROP_URI:
      sushi_media_bin_set_uri (SUSHI_MEDIA_BIN (object),
                               g_value_get_string (value));
      break;
    case PROP_VOLUME:
      sushi_media_bin_set_volume (SUSHI_MEDIA_BIN (object),
                                  g_value_get_double (value));
      break;
    case PROP_AUTOHIDE_TIMEOUT:
      sushi_media_bin_set_autohide_timeout (SUSHI_MEDIA_BIN (object),
                                            g_value_get_int (value));
      break;
    case PROP_FULLSCREEN:
      sushi_media_bin_set_fullscreen (SUSHI_MEDIA_BIN (object),
                                      g_value_get_boolean (value));
      break;
    case PROP_SHOW_STREAM_INFO:
      sushi_media_bin_set_show_stream_info (SUSHI_MEDIA_BIN (object),
                                            g_value_get_boolean (value));
      break;
    case PROP_AUDIO_MODE:
      sushi_media_bin_set_audio_mode (SUSHI_MEDIA_BIN (object),
                                      g_value_get_boolean (value));
      break;
    case PROP_TITLE:
      sushi_media_bin_set_title (SUSHI_MEDIA_BIN (object),
                                 g_value_get_string (value));
      break;
    case PROP_DESCRIPTION:
      sushi_media_bin_set_description (SUSHI_MEDIA_BIN (object),
                                       g_value_get_string (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
sushi_media_bin_get_property (GObject    *object,
                              guint       prop_id,
                              GValue     *value,
                              GParamSpec *pspec)
{
  SushiMediaBinPrivate *priv;

  g_return_if_fail (SUSHI_IS_MEDIA_BIN (object));
  priv = SMB_PRIVATE (SUSHI_MEDIA_BIN (object));

  switch (prop_id)
    {
    case PROP_URI:
      g_value_set_string (value, priv->uri);
      break;
    case PROP_VOLUME:
      g_value_set_double (value, gtk_adjustment_get_value (priv->volume_adjustment));
      break;
    case PROP_AUTOHIDE_TIMEOUT:
      g_value_set_int (value, priv->autohide_timeout);
      break;
    case PROP_FULLSCREEN:
      g_value_set_boolean (value, priv->fullscreen);
      break;
    case PROP_SHOW_STREAM_INFO:
      g_value_set_boolean (value, priv->show_stream_info);
      break;
    case PROP_AUDIO_MODE:
      g_value_set_boolean (value, priv->audio_mode);
      break;
    case PROP_TITLE:
      g_value_set_string (value, priv->title);
      break;
    case PROP_DESCRIPTION:
      g_value_set_string (value, priv->description);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static GtkSizeRequestMode
sushi_media_bin_get_request_mode (GtkWidget *self)
{
  return GTK_SIZE_REQUEST_CONSTANT_SIZE;
}


static void
sushi_media_bin_get_preferred_width (GtkWidget *self,
                                     gint      *minimum_width,
                                     gint      *natural_width)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (SUSHI_MEDIA_BIN (self));

  if (priv->audio_mode)
    {
      GTK_WIDGET_CLASS (sushi_media_bin_parent_class)->get_preferred_width
        (self, minimum_width, natural_width);
    }
  else
    {
      *minimum_width = priv->video_width ? 320 : 0;
      *natural_width = priv->video_width ? priv->video_width : 0;
    }
}

static void
sushi_media_bin_get_preferred_height (GtkWidget *self,
                                      gint      *minimum_height,
                                      gint      *natural_height)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (SUSHI_MEDIA_BIN (self));

  if (priv->audio_mode)
    {
      GTK_WIDGET_CLASS (sushi_media_bin_parent_class)->get_preferred_height
        (self, minimum_height, natural_height);
    }
  else
    {
      *minimum_height = priv->video_height ? 240 : 0;
      *natural_height = priv->video_height ? priv->video_height : 0;
    }
}

#define SMB_DEFINE_ACTION_SIGNAL(klass, name, handler,...) \
  g_signal_new_class_handler (name, \
                              G_TYPE_FROM_CLASS (klass), \
                              G_SIGNAL_RUN_LAST | G_SIGNAL_ACTION, \
                              G_CALLBACK (handler), \
                              NULL, NULL, NULL, \
                              G_TYPE_NONE, __VA_ARGS__)

static void
sushi_media_bin_class_init (SushiMediaBinClass *klass)
{
  GObjectClass   *object_class = G_OBJECT_CLASS (klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS (klass);

  object_class->dispose = sushi_media_bin_dispose;
  object_class->finalize = sushi_media_bin_finalize;
  object_class->set_property = sushi_media_bin_set_property;
  object_class->get_property = sushi_media_bin_get_property;

  widget_class->get_request_mode = sushi_media_bin_get_request_mode;
  widget_class->get_preferred_width = sushi_media_bin_get_preferred_width;
  widget_class->get_preferred_height = sushi_media_bin_get_preferred_height;

  /* Properties */
  properties[PROP_URI] =
    g_param_spec_string ("uri",
                         "URI",
                         "The Media URI to playback",
                         NULL,
                         G_PARAM_READWRITE);

  properties[PROP_VOLUME] =
    g_param_spec_double ("volume",
                         "Volume",
                         "Stream volume",
                         0.0, 1.0, 1.0,
                         G_PARAM_READWRITE);

  properties[PROP_AUTOHIDE_TIMEOUT] =
    g_param_spec_int ("autohide-timeout",
                      "Auto hide timeout",
                      "Controls auto hide timeout in seconds",
                      0, G_MAXINT,
                      AUTOHIDE_TIMEOUT_DEFAULT,
                      G_PARAM_READWRITE);

  properties[PROP_FULLSCREEN] =
    g_param_spec_boolean ("fullscreen",
                          "Fullscreen",
                          "Whether to show the video in fullscreen or not",
                          FALSE,
                          G_PARAM_READWRITE);

  properties[PROP_SHOW_STREAM_INFO] =
    g_param_spec_boolean ("show-stream-info",
                          "Show stream info",
                          "Whether to show stream information or not",
                          FALSE,
                          G_PARAM_READWRITE);

  properties[PROP_AUDIO_MODE] =
    g_param_spec_boolean ("audio-mode",
                          "Audio Mode",
                          "Wheter to show controls suitable for audio files only",
                          FALSE,
                          G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY);

  properties[PROP_TITLE] =
    g_param_spec_string ("title",
                         "Title",
                         "The title to display",
                         NULL,
                         G_PARAM_READWRITE);

  properties[PROP_DESCRIPTION] =
    g_param_spec_string ("description",
                         "Description",
                         "Audio/Video description",
                         NULL,
                         G_PARAM_READWRITE);

  g_object_class_install_properties (object_class, N_PROPERTIES, properties);

  /**
   * SushiMediaBin::error:
   * @self: the #SushiMediaBin which received the signal.
   * @error: the #GError
   */
  sushi_media_bin_signals[ERROR] =
      g_signal_new_class_handler ("error",
                                  G_TYPE_FROM_CLASS (object_class),
                                  G_SIGNAL_RUN_LAST,
                                  G_CALLBACK (sushi_media_bin_error),
                                  g_signal_accumulator_true_handled, NULL,
                                  NULL,
                                  G_TYPE_BOOLEAN, 1, G_TYPE_ERROR);
  /**
   * SushiMediaBin::size-change:
   * @self: the #SushiMediaBin which received the signal.
   */
  sushi_media_bin_signals[SIZE_CHANGE] =
      g_signal_new ("size-change",
                    G_TYPE_FROM_CLASS (object_class),
                    G_SIGNAL_RUN_LAST,
                    0, NULL, NULL, NULL,
                    G_TYPE_NONE, 0);

  /**
   * SushiMediaBin::tags-change:
   * @self: the #SushiMediaBin which received the signal.
   */
  sushi_media_bin_signals[TAGS_CHANGE] =
      g_signal_new ("tags-change",
                    G_TYPE_FROM_CLASS (object_class),
                    G_SIGNAL_RUN_LAST,
                    0, NULL, NULL, NULL,
                    G_TYPE_NONE, 0);

  /* Action signals for key bindings */
  SMB_DEFINE_ACTION_SIGNAL (object_class, "toggle", sushi_media_bin_action_toggle, 1, G_TYPE_STRING);
  SMB_DEFINE_ACTION_SIGNAL (object_class, "seek", sushi_media_bin_action_seek, 1, G_TYPE_INT);

  /* Template */
  gtk_widget_class_set_template_from_resource (widget_class, "/org/gnome/Sushi/libsushi/SushiMediaBin.ui");

  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, stack);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, playback_adjustment);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, volume_adjustment);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, playback_image);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, fullscreen_image);

  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, overlay);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, play_box);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, volume_button);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, title_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, info_box);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, duration_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, progress_duration_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, progress_position_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, top_revealer);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, bottom_revealer);

  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, audio_box);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, audio_duration_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, audio_volume_button);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, audio_position_label);
  gtk_widget_class_bind_template_child_private (widget_class, SushiMediaBin, audio_playback_image);

  gtk_widget_class_bind_template_callback (widget_class, on_sushi_media_bin_realize);
  gtk_widget_class_bind_template_callback (widget_class, on_sushi_media_bin_unrealize);

  gtk_widget_class_bind_template_callback (widget_class, on_overlay_motion_notify_event);
  gtk_widget_class_bind_template_callback (widget_class, on_overlay_button_press_event);
  gtk_widget_class_bind_template_callback (widget_class, on_overlay_button_release_event);

  gtk_widget_class_bind_template_callback (widget_class, on_revealer_motion_notify_event);
  gtk_widget_class_bind_template_callback (widget_class, on_revealer_leave_notify_event);

  gtk_widget_class_bind_template_callback (widget_class, on_progress_scale_format_value);
  gtk_widget_class_bind_template_callback (widget_class, on_playback_adjustment_value_changed);

  gtk_widget_class_bind_template_callback (widget_class, sushi_media_bin_toggle_playback);
  gtk_widget_class_bind_template_callback (widget_class, sushi_media_bin_toggle_fullscreen);

  /* Setup CSS */
  gtk_widget_class_set_css_name (widget_class, "sushi-media-bin");

  /* Init GStreamer */
  gst_init_check (NULL, NULL, NULL);
  GST_DEBUG_CATEGORY_INIT (sushi_media_bin_debug, "SushiMediaBin", 0, "SushiMediaBin audio/video widget");
}

/*************************** Fullscreen Window Type ***************************/

G_DECLARE_FINAL_TYPE (SushiMediaBinWindow, sushi_media_bin_window, SUSHI, MEDIA_BIN_WINDOW, GtkWindow)

struct _SushiMediaBinWindow
{
  GtkWindow parent;
};

G_DEFINE_TYPE (SushiMediaBinWindow, sushi_media_bin_window, GTK_TYPE_WINDOW);

static void
sushi_media_bin_window_init (SushiMediaBinWindow *self)
{
  gtk_window_set_decorated (GTK_WINDOW (self), FALSE);
}

static void
sushi_media_bin_window_class_init (SushiMediaBinWindowClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  gtk_widget_class_set_css_name (GTK_WIDGET_CLASS (klass), "sushi-media-bin");

  SMB_DEFINE_ACTION_SIGNAL (object_class, "toggle", NULL, 1, G_TYPE_STRING);
  SMB_DEFINE_ACTION_SIGNAL (object_class, "seek", NULL, 1, G_TYPE_INT);
}

static GtkWindow *
sushi_media_bin_window_new (SushiMediaBin *bin)
{
  GObject *window = g_object_new (sushi_media_bin_window_get_type (), NULL);

  g_signal_connect_swapped (window, "delete-event", G_CALLBACK (sushi_media_bin_toggle_fullscreen), bin);
  g_signal_connect_swapped (window, "toggle", G_CALLBACK (sushi_media_bin_action_toggle), bin);
  g_signal_connect_swapped (window, "seek", G_CALLBACK (sushi_media_bin_action_seek), bin);

  return (GtkWindow *) window;
}

/*********************************** Utils ************************************/

#define TIME_HOURS(t)   (t / 3600)
#define TIME_MINUTES(t) ((t % 3600) / 60)
#define TIME_SECONDS(t) (t % 60)

static const gchar *
format_time (gint time)
{
  static gchar buffer[16];
  gint hours = TIME_HOURS (time);

  if (hours)
    g_snprintf (buffer,
                sizeof (buffer),
                "%d:%02d:%02d",
                hours,
                TIME_MINUTES (time),
                TIME_SECONDS (time));
  else
    g_snprintf (buffer,
                sizeof (buffer),
                "%d:%02d",
                TIME_MINUTES (time),
                TIME_SECONDS (time));

  return (const gchar *) buffer;
}

static void
on_widget_style_updated (GtkWidget *widget, gpointer data)
{
  gboolean visible = GPOINTER_TO_INT (data);
  gdouble opacity;

  gtk_style_context_get (gtk_widget_get_style_context (widget),
                         gtk_widget_get_state_flags (widget),
                         "opacity", &opacity, NULL);

  if ((visible && opacity >= 1.0) || (!visible && opacity == 0.0))
    {
      gtk_widget_set_visible (widget, visible);
      g_signal_handlers_disconnect_by_func (widget, on_widget_style_updated, data);
    }
}

static void
widget_set_visible (GtkWidget *widget, gboolean visible)
{
  GtkStyleContext *context = gtk_widget_get_style_context (widget);

  g_signal_handlers_disconnect_by_func (widget, on_widget_style_updated, GINT_TO_POINTER (TRUE));
  g_signal_handlers_disconnect_by_func (widget, on_widget_style_updated, GINT_TO_POINTER (FALSE));

  gtk_style_context_remove_class (context, visible ? "hide" : "show");
  gtk_style_context_add_class (context, visible ? "show" : "hide");

  if (visible)
    gtk_widget_show (widget);

  g_signal_connect (widget, "style-updated",
                    G_CALLBACK (on_widget_style_updated),
                    GINT_TO_POINTER (visible));
}

/* The following macros are used to define generic getters and setters */

#define SMB_DEFINE_GETTER_FULL(type, prop, retval, retstmt) \
type \
sushi_media_bin_get_##prop (SushiMediaBin *self) \
{ \
  g_return_val_if_fail (SUSHI_IS_MEDIA_BIN (self), retval); \
  retstmt \
}

#define SMB_DEFINE_GETTER(type, prop, retval) \
  SMB_DEFINE_GETTER_FULL (type, prop, retval, return SMB_PRIVATE (self)->prop;)

#define SMB_DEFINE_SETTER_FULL(type, prop, PROP, setup, cmp, assign, code) \
void \
sushi_media_bin_set_##prop (SushiMediaBin *self, type prop) \
{ \
  SushiMediaBinPrivate *priv; \
  g_return_if_fail (SUSHI_IS_MEDIA_BIN (self)); \
  priv = SMB_PRIVATE (self); \
  setup; \
  if (cmp) \
    { \
      assign; \
      code; \
      g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_##PROP]); \
    } \
}

/* The last argument is for custom code that will be added just before calling
 * g_object_notify_by_pspec()
 */
#define SMB_DEFINE_SETTER(type, prop, PROP, code) \
  SMB_DEFINE_SETTER_FULL(type, prop, PROP, \
    , \
    priv->prop != prop, \
    priv->prop = prop, \
    code)

#define SMB_DEFINE_SETTER_BOOLEAN(prop, PROP, code) \
  SMB_DEFINE_SETTER_FULL(gboolean, prop, PROP, \
    prop = (prop) ? TRUE : FALSE, \
    priv->prop != prop, \
    priv->prop = prop, \
    code)

#define SMB_DEFINE_SETTER_STRING(prop, PROP, code) \
  SMB_DEFINE_SETTER_FULL(const gchar *, prop, PROP, \
    , \
    g_strcmp0 (priv->prop, prop), \
    g_free (priv->prop); priv->prop = g_strdup (prop), \
    code)


/******************************** GST Support *********************************/
static inline gboolean
sushi_media_bin_handle_msg_error (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GError *error = NULL;
  gboolean handled;

  gst_message_parse_error (msg, &error, NULL);

  if (priv->play)
    gst_element_set_state (priv->play, GST_STATE_NULL);

  g_signal_emit (self, sushi_media_bin_signals[ERROR], 0, error, &handled);

  g_error_free (error);

  return handled;
}

static inline void
sushi_media_bin_update_duration (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint64 duration;

  if (!gst_element_query_duration (priv->play, GST_FORMAT_TIME, &duration)
      || priv->duration == duration)
    return;

  priv->duration = duration;

  duration = GST_TIME_AS_SECONDS (duration);
  gtk_label_set_label (priv->audio_duration_label, format_time (duration));
  gtk_label_set_label (priv->duration_label, format_time (duration));
  gtk_label_set_label (priv->progress_duration_label, format_time (duration));
  gtk_adjustment_set_upper (priv->playback_adjustment, duration);
}

static inline void
sushi_media_bin_update_position (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint position = GST_TIME_AS_SECONDS (sushi_media_bin_get_position (self));

  if (priv->position == position)
    return;

  priv->position = position;

  priv->ignore_adjustment_changes = TRUE;
  gtk_adjustment_set_value (priv->playback_adjustment, position);
  priv->ignore_adjustment_changes = FALSE;

  gtk_label_set_label (priv->progress_position_label, format_time (position));
  gtk_label_set_label (priv->audio_position_label, format_time (position));
}

static inline void
log_fps (SushiMediaBin *self, GdkFrameClock *frame_clock)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gint64 frame_time, time;
  GstSample *sample;

  /* Get current buffer and return if its the same as last tick */
  g_object_get (priv->play, "sample", &sample, NULL);
  if (sample)
    {
      GstBuffer *buffer = gst_sample_get_buffer (sample);
      gst_sample_unref (sample);
      
      if (priv->last_buffer == buffer)
        return;

      priv->last_buffer = buffer;
    }
  else
    return;

  frame_time = gdk_frame_clock_get_frame_time (frame_clock);

  /* Initialize state variables */
  if (priv->tick_start == 0)
    {
      priv->tick_start = frame_time;
      priv->frames_window_start = frame_time;
      priv->frames_window = 0;
      priv->frames_rendered = 0;
    }
  else if (priv->frames_window == 0)
    priv->frames_window_start = frame_time;

  priv->frames_window++;

  /* We only print FPS once every FPS_WINDOW_SIZE seconds */
  time = frame_time - priv->frames_window_start;
  if (time < FPS_WINDOW_SIZE * 1000000)
    return;

  priv->frames_rendered += priv->frames_window;

  GST_INFO ("FPS: %lf average: %lf",
            priv->frames_window / (time / 1000000.0),
            priv->frames_rendered / ((frame_time - priv->tick_start) / 1000000.0));

  priv->frames_window = 0;
}

static gboolean
sushi_media_bin_tick_callback (GtkWidget     *widget,
                               GdkFrameClock *frame_clock,
                               gpointer       user_data)
{
  static GstDebugLevel level;

  sushi_media_bin_update_position ((SushiMediaBin *)user_data);

  if (level == 0)
    level = gst_debug_category_get_threshold (sushi_media_bin_debug);

  if (level >= GST_LEVEL_INFO)
    log_fps ((SushiMediaBin *)user_data, frame_clock);

  return G_SOURCE_CONTINUE;
}

static void
sushi_media_bin_set_tick_enabled (SushiMediaBin *self, gboolean enabled)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  if (priv->tick_id)
    {
      gtk_widget_remove_tick_callback (GTK_WIDGET (self), priv->tick_id);
      priv->tick_id = priv->tick_start = 0;
    }

  if (enabled)
    priv->tick_id = gtk_widget_add_tick_callback (priv->audio_mode ? priv->audio_box : priv->overlay,
                                                  sushi_media_bin_tick_callback,
                                                  self, NULL);
}

static inline void
sushi_media_bin_dump_dot (SushiMediaBin *self, GstState old, GstState new)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  gchar *filename;

  filename = g_strdup_printf ("%s_%s_%s", g_get_prgname (),
                              gst_element_state_get_name (old),
                              gst_element_state_get_name (new));
  gst_debug_bin_to_dot_file_with_ts (GST_BIN (priv->play),
                                     GST_DEBUG_GRAPH_SHOW_ALL,
                                     filename);
  g_free (filename);
}

static inline void
sushi_media_bin_handle_msg_state_changed (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GstState old_state, new_state;

  gst_message_parse_state_changed (msg, &old_state, &new_state, NULL);

  if (old_state == new_state ||
      GST_MESSAGE_SRC (msg) != GST_OBJECT (priv->play))
    return;

  GST_DEBUG ("State changed from %s to %s",
             gst_element_state_get_name (old_state),
             gst_element_state_get_name (new_state));

  if (priv->dump_dot_file)
    sushi_media_bin_dump_dot (self, old_state, new_state);

  /* Update UI */
  if (old_state == GST_STATE_READY && new_state == GST_STATE_PAUSED)
    {
      gtk_image_set_from_icon_name (priv->playback_image, SMB_ICON_NAME_PLAY, SMB_ICON_SIZE);
      widget_set_visible (priv->play_box, FALSE);
      sushi_media_bin_update_duration (self);
    }
  else if (new_state == GST_STATE_PLAYING)
    {
      widget_set_visible (priv->play_box, FALSE);
      gtk_image_set_from_icon_name (priv->playback_image, SMB_ICON_NAME_PAUSE, SMB_ICON_SIZE);
      sushi_media_bin_set_tick_enabled (self, TRUE);
    }
  else
    {
      gtk_image_set_from_icon_name (priv->playback_image, SMB_ICON_NAME_PLAY, SMB_ICON_SIZE);
      widget_set_visible (priv->play_box, FALSE);
      priv->position = 0;
      sushi_media_bin_set_tick_enabled (self, FALSE);
    }
}

typedef struct {
  GString *tag;
  GString *val;
} MetaDataStrings;

static void
print_tag (const GstTagList *list, const gchar *tag, gpointer data)
{
  MetaDataStrings *metadata = data;
  gint i, n;

  for (i = 0, n = gst_tag_list_get_tag_size (list, tag); i < n; ++i)
    {
      const GValue *val = gst_tag_list_get_value_index (list, tag, i);
      GValue str = {0, };

      g_value_init (&str, G_TYPE_STRING);
      g_value_transform (val, &str);

      g_string_append_printf (metadata->tag, "\n    %s", tag);
      g_string_append_printf (metadata->val, "\n: %s", g_value_get_string (&str));

      g_value_unset (&str);
    }
}

static inline void
meta_data_strings_set_title (MetaDataStrings *metadata, const gchar *title)
{
  g_string_assign (metadata->tag, title);
  g_string_assign (metadata->val, "");
}

static inline void
meta_data_strings_set_info (MetaDataStrings *metadata,
                            GtkLabel        *left,
                            GtkLabel        *right,
                            GstTagList      *tags)
{
  if (tags)
    {
      gst_tag_list_foreach (tags, print_tag, metadata);

      gtk_label_set_label (left, metadata->tag->str);
      gtk_label_set_label (right, metadata->val->str);
    }
  else
    {
      gtk_label_set_label (left, "");
      gtk_label_set_label (right, "");
    }
}

static inline void
sushi_media_bin_update_stream_info (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  MetaDataStrings metadata = { g_string_new (""), g_string_new ("") };

  meta_data_strings_set_title (&metadata, "Audio:");
  meta_data_strings_set_info (&metadata,
                              priv->info_column_label[0],
                              priv->info_column_label[1],
                              priv->audio_tags);

  meta_data_strings_set_title (&metadata, "Video:");
  if (priv->video_width && priv->video_height)
    {
      g_string_append_printf (metadata.tag, "\n    video-resolution");
      g_string_append_printf (metadata.val, "\n: %dx%d", priv->video_width, priv->video_height);
    }
  meta_data_strings_set_info (&metadata,
                              priv->info_column_label[2],
                              priv->info_column_label[3],
                              priv->video_tags);

  meta_data_strings_set_title (&metadata, "Text:");
  meta_data_strings_set_info (&metadata,
                              priv->info_column_label[4],
                              priv->info_column_label[5],
                              priv->text_tags);

  g_string_free (metadata.tag, TRUE);
  g_string_free (metadata.val, TRUE);
}

static inline void
sushi_media_bin_handle_msg_application (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  const GstStructure *structure;
  const gchar *name;

  structure = gst_message_get_structure (msg);
  name = gst_structure_get_name (structure);
  g_return_if_fail (name != NULL);

  if (priv->show_stream_info)
    sushi_media_bin_update_stream_info (self);

  /* TODO: handle audio and text tags */
  if (g_str_equal (name, "video-tags-changed"))
    {
      gchar *value = NULL;

      if (!priv->title_user_set)
        {
          if (priv->video_tags)
            gst_tag_list_get_string_index (priv->video_tags, GST_TAG_TITLE, 0, &value);

          sushi_media_bin_set_title (self, value);
          priv->title_user_set = FALSE;
          g_clear_pointer (&value, g_free);
        }

      if (!priv->description_user_set)
        {
          /* Get description from comment or description tags */
          if (priv->video_tags)
            {
              /* We try comment tag first and then description */
              if (!gst_tag_list_get_string_index (priv->video_tags, GST_TAG_COMMENT, 0, &value))
                gst_tag_list_get_string_index (priv->video_tags, GST_TAG_DESCRIPTION, 0, &value);
            }

          sushi_media_bin_set_description (self, value);
          priv->description_user_set = FALSE;
          g_clear_pointer (&value, g_free);
        }
    }
}

static inline void
sushi_media_bin_handle_msg_eos (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  GST_DEBUG ("Got EOS");

  gst_element_set_state (priv->play, GST_STATE_NULL);
  sushi_media_bin_set_state (self, SMB_INITIAL_STATE);
  sushi_media_bin_update_position (self);
}

static inline void
sushi_media_bin_post_message_application (SushiMediaBin *self, const gchar *name)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GstStructure *data = gst_structure_new (name, NULL, NULL);

  /* Post message on the bus for the main thread to pick it up */
  gst_element_post_message (priv->play,
                            gst_message_new_application (GST_OBJECT (priv->play),
                                                         data));
}

static inline void
sushi_media_bin_handle_msg_tag (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GstObject *src = GST_MESSAGE_SRC (msg);
  GstTagList *tags = NULL, *old_tags = NULL;
  const gchar *type = NULL;

  gst_message_parse_tag (msg, &tags);

  if (g_type_is_a (G_OBJECT_TYPE (src), GST_TYPE_VIDEO_SINK))
    {
      old_tags = priv->video_tags;
      if (!old_tags || (old_tags && !gst_tag_list_is_equal (old_tags, tags)))
        {
          type = "video-tags-changed";
          priv->video_tags = gst_tag_list_merge (old_tags, tags, GST_TAG_MERGE_REPLACE);
        }
    }
  else if (g_type_is_a (G_OBJECT_TYPE (src), GST_TYPE_AUDIO_BASE_SINK))
    {
      old_tags = priv->audio_tags;
      if (!old_tags || (old_tags && !gst_tag_list_is_equal (old_tags, tags)))
        {
          type = "audio-tags-changed";
          priv->audio_tags = gst_tag_list_merge (old_tags, tags, GST_TAG_MERGE_REPLACE);
        }
    }

  /* Post message on the bus for the main thread to pick it up */
  if (type)
    {
      sushi_media_bin_post_message_application (self, type);
      g_signal_emit (self, sushi_media_bin_signals[TAGS_CHANGE], 0);
      g_clear_pointer (&old_tags, gst_tag_list_unref);
    }

  gst_tag_list_unref (tags);
}

static inline void
sushi_media_bin_handle_streams_selected (SushiMediaBin *self, GstMessage *msg)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);
  GstStreamCollection *collection = NULL;
  GstStream *stream = NULL;
  GstStructure *caps_struct;
  GstCaps *caps;
  gint i, n, w, h;

  gst_message_parse_streams_selected (msg, &collection);
  n = gst_stream_collection_get_size (collection);

  for (i = 0; i < n; i++)
    {
      stream = gst_stream_collection_get_stream (collection, i);

      if (gst_stream_get_stream_type (stream) == GST_STREAM_TYPE_VIDEO)
        break;
    }

  if (!stream)
    return;

  caps = gst_stream_get_caps (stream);
  caps_struct = gst_caps_get_structure (caps, 0);

  if (gst_structure_get_int (caps_struct, "width", &w) &&
      gst_structure_get_int (caps_struct, "height", &h))
    {
      if (priv->video_width != w || priv->video_height != h)
        {
          priv->video_width = w;
          priv->video_height = h;
          gtk_widget_queue_resize (GTK_WIDGET (self));
        }
    }
  else
    priv->video_width = priv->video_height = 0;

  g_signal_emit (self, sushi_media_bin_signals[SIZE_CHANGE], 0);

  gst_caps_unref (caps);
  gst_object_unref (collection);
}

static gboolean
sushi_media_bin_bus_watch (GstBus *bus, GstMessage *msg, gpointer data)
{
  SushiMediaBin *self = data;

  switch (GST_MESSAGE_TYPE (msg))
    {
    case GST_MESSAGE_APPLICATION:
      sushi_media_bin_handle_msg_application (self, msg);
      break;
    case GST_MESSAGE_DURATION_CHANGED:
      sushi_media_bin_update_duration (self);
      break;
    case GST_MESSAGE_EOS:
      sushi_media_bin_handle_msg_eos (self, msg);
      break;
    case GST_MESSAGE_ERROR:
      return sushi_media_bin_handle_msg_error (self, msg);
    case GST_MESSAGE_STATE_CHANGED:
      sushi_media_bin_handle_msg_state_changed (self, msg);
      break;
    case GST_MESSAGE_STREAMS_SELECTED:
      sushi_media_bin_handle_streams_selected (self, msg);
      break;
    case GST_MESSAGE_TAG:
      sushi_media_bin_handle_msg_tag (self, msg);
      break;
    default:
      break;
    }

  return G_SOURCE_CONTINUE;
}

static void
sushi_media_bin_init_playbin (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv = SMB_PRIVATE (self);

  priv->play = gst_element_factory_make ("playbin3", "SushiMediaBinPlayBin");
  gst_object_ref_sink (priv->play);

  /* Setup volume */
  /* NOTE: Bidirectional binding makes the app crash on X11 */
  g_object_bind_property (priv->volume_adjustment, "value",
                          priv->play, "volume",
                          G_BINDING_SYNC_CREATE);

  /* Watch bus */
  priv->bus = gst_pipeline_get_bus (GST_PIPELINE (priv->play));
  gst_bus_add_watch (priv->bus, sushi_media_bin_bus_watch, self);
}

/********************************* Public API *********************************/

/**
 * sushi_media_bin_new:
 * @audio_mode:
 *
 * Returns a new #SushiMediaBin
 *
 */
GtkWidget *
sushi_media_bin_new (gboolean audio_mode)
{
  return (GtkWidget*) g_object_new (SUSHI_TYPE_MEDIA_BIN,
                                    "audio-mode", audio_mode,
                                    NULL);
}

/**
 * sushi_media_bin_get_uri:
 * @self: a #SushiMediaBin
 *
 * Return the media URI
 */
SMB_DEFINE_GETTER (const gchar *, uri, NULL)

/**
 * sushi_media_bin_set_uri:
 * @self: a #SushiMediaBin
 * @uri:
 *
 * Sets the media URI to play
 */
SMB_DEFINE_SETTER_STRING (uri, URI,
  /* Make playbin show the first video frame if there is an URI
   * and the widget is realized.
   */
  sushi_media_bin_update_state (self);

  /* Clear tag lists */
  if (priv->audio_tags)
    {
      g_clear_pointer (&priv->audio_tags, gst_tag_list_unref);
      sushi_media_bin_post_message_application (self, "audio-tags-changed");
    }

  if (priv->video_tags)
    {
      g_clear_pointer (&priv->video_tags, gst_tag_list_unref);
      sushi_media_bin_post_message_application (self, "video-tags-changed");
    }

  if (priv->text_tags)
    {
      g_clear_pointer (&priv->text_tags, gst_tag_list_unref);
      sushi_media_bin_post_message_application (self, "text-tags-changed");
    }
)

/**
 * sushi_media_bin_get_autohide_timeout:
 * @self: a #SushiMediaBin
 *
 * Returns control's auto hide timeout in seconds.
 */
SMB_DEFINE_GETTER (gint, autohide_timeout, 0)

/**
 * sushi_media_bin_set_autohide_timeout:
 * @self: a #SushiMediaBin
 * @autohide_timeout: A timeout in seconds
 *
 * Sets the timeout to auto hide controls
 */
SMB_DEFINE_SETTER (gint, autohide_timeout, AUTOHIDE_TIMEOUT,)

/**
 * sushi_media_bin_get_fullscreen:
 * @self: a #SushiMediaBin
 *
 * Returns whether video is fullscreen or not
 */
SMB_DEFINE_GETTER (gboolean, fullscreen, FALSE)

/**
 * sushi_media_bin_set_fullscreen:
 * @self: a #SushiMediaBin
 * @fullscreen:
 *
 * Sets whether to show the video in fullscreen mode or not
 */
SMB_DEFINE_SETTER_BOOLEAN (fullscreen, FULLSCREEN,
  /* If there is no video sink, delay fullscreen until realize event */
  if (priv->video_sink)
    sushi_media_bin_fullscreen_apply (self, fullscreen);
)

/**
 * sushi_media_bin_get_show_stream_info:
 * @self: a #SushiMediaBin
 *
 * Returns whether streams information are show or not
 */
SMB_DEFINE_GETTER (gboolean, show_stream_info, FALSE)

/**
 * sushi_media_bin_set_show_stream_info:
 * @self: a #SushiMediaBin
 * @show_stream_info:
 *
 * Sets whether to show stream information or not
 */
SMB_DEFINE_SETTER_BOOLEAN (show_stream_info, SHOW_STREAM_INFO,

  if (show_stream_info)
    {
      sushi_media_bin_update_stream_info (self);
      gtk_widget_show (priv->info_box);
    }
  else
    {
      gint i;

      gtk_widget_hide (priv->info_box);

      for (i = 0; i < INFO_N_COLUMNS; i++)
        gtk_label_set_label (priv->info_column_label[i], "");
    }
)

/**
 * sushi_media_bin_get_title:
 * @self: a #SushiMediaBin
 *
 * Returns the media title if any
 */
SMB_DEFINE_GETTER (const gchar *, title, NULL)

/**
 * sushi_media_bin_set_title:
 * @self: a #SushiMediaBin
 * @title:
 *
 * Sets the media title.
 * By default SushiMediaBin will use the title from the media metadata
 */
SMB_DEFINE_SETTER_STRING (title, TITLE,
  gtk_label_set_label (priv->title_label, title);
  gtk_widget_set_visible (GTK_WIDGET (priv->title_label), title != NULL);
  priv->title_user_set = TRUE;
)

/**
 * sushi_media_bin_get_description:
 * @self: a #SushiMediaBin
 *
 * Returns the media description if any
 */
SMB_DEFINE_GETTER (const gchar *, description, NULL)

/**
 * sushi_media_bin_set_description:
 * @self: a #SushiMediaBin
 * @description:
 *
 * Sets the media description.
 * By default SushiMediaBin will use the description from the media metadata
 */
SMB_DEFINE_SETTER_STRING (description, DESCRIPTION,
  priv->description_user_set = TRUE;
)

/**
 * sushi_media_bin_get_volume:
 * @self: a #SushiMediaBin
 *
 * Returns audio volume from 0.0 to 1.0
 */
SMB_DEFINE_GETTER_FULL (gdouble, volume, 1.0,
  return gtk_adjustment_get_value (SMB_PRIVATE (self)->volume_adjustment);
)

/**
 * sushi_media_bin_set_volume:
 * @self: a #SushiMediaBin
 * @volume: from 0.0 to 1.0
 *
 * Sets the audio volume
 */
SMB_DEFINE_SETTER_FULL (gdouble, volume, VOLUME,
  volume = CLAMP (volume, 0.0, 1.0),
  gtk_adjustment_get_value (priv->volume_adjustment) != volume,
  gtk_adjustment_set_value (priv->volume_adjustment, volume),
)

/**
 * sushi_media_bin_get_audio_tags:
 * @self: a #SushiMediaBin
 *
 * Returns a #GstTagList with the audio tags for the played media
 */
SMB_DEFINE_GETTER_FULL (GstTagList *, audio_tags, NULL,
  return (gst_tag_list_ref (SMB_PRIVATE (self)->audio_tags));
)

/**
 * sushi_media_bin_get_video_tags:
 * @self: a #SushiMediaBin
 *
 * Returns a #GstTagList with the video tags for the played media
 */
SMB_DEFINE_GETTER_FULL (GstTagList *, video_tags, NULL,
  return (gst_tag_list_ref (SMB_PRIVATE (self)->video_tags));
)

/**
 * sushi_media_bin_play:
 * @self: a #SushiMediaBin
 *
 * Start media playback
 */
void
sushi_media_bin_play (SushiMediaBin *self)
{
  SushiMediaBinPrivate *priv;

  g_return_if_fail (SUSHI_IS_MEDIA_BIN (self));
  priv = SMB_PRIVATE (self);

  g_object_set (priv->play, "uri", priv->uri, NULL);

  sushi_media_bin_set_state (self, GST_STATE_PLAYING);
}

/**
 * sushi_media_bin_pause:
 * @self: a #SushiMediaBin
 *
 * Pause media playback
 */
void
sushi_media_bin_pause (SushiMediaBin *self)
{
  g_return_if_fail (SUSHI_IS_MEDIA_BIN (self));
  sushi_media_bin_set_state (self, GST_STATE_PAUSED);
}

/**
 * sushi_media_bin_stop:
 * @self: a #SushiMediaBin
 *
 * Stop media playback
 */
void
sushi_media_bin_stop (SushiMediaBin *self)
{
  g_return_if_fail (SUSHI_IS_MEDIA_BIN (self));
  sushi_media_bin_set_state (self, GST_STATE_NULL);
}

static void
sushi_media_bin_free_pixbuf (guchar *pixels, gpointer data)
{
  gst_sample_unref (GST_SAMPLE (data));
}

/**
 * sushi_media_bin_screenshot:
 * @self: a #SushiMediaBin
 * @width: desired screenshot width or -1 for original size
 * @height: desired screenshot height or -1 for original size
 *
 * Takes a screenshot of the current frame.
 *
 * Returns: (transfer full): a new #GdkPixbuf
 */
GdkPixbuf *
sushi_media_bin_screenshot (SushiMediaBin *self, gint width, gint height)
{
  SushiMediaBinPrivate *priv;
  GdkPixbuf *retval = NULL;
  GstSample *sample;
  GstCaps   *caps;
  GstBuffer *buffer;
  GstMemory *memory = NULL;
  GstMapInfo info;

  g_return_val_if_fail (SUSHI_IS_MEDIA_BIN (self), NULL);
  priv = SMB_PRIVATE (self);

  /* Create a caps object with the desired format */
  caps = gst_caps_new_simple ("video/x-raw",
                              "format", G_TYPE_STRING, "RGB",
                              "pixel-aspect-ratio", GST_TYPE_FRACTION, 1, 1,
                              NULL);

  if (width >= 0 && width >= 0)
    gst_caps_set_simple (caps,
                         "width", G_TYPE_INT, width,
                         "height", G_TYPE_INT, height,
                         NULL);

  /* Get current sample in RGB */
  g_signal_emit_by_name (priv->play, "convert-sample", caps, &sample);
  gst_caps_unref (caps);

  if (sample)
    {
      GstStructure *caps_struct;

      if (!(caps = gst_sample_get_caps (sample)))
        return NULL;

      caps_struct = gst_caps_get_structure (caps, 0);

      if (!(gst_structure_get_int (caps_struct, "width", &width) &&
            gst_structure_get_int (caps_struct, "height", &height)))
        return NULL;
    }
  else
    {
      /* FIXME: gst does not suport converting from video/x-raw(memory:GLMemory) */
      g_warning ("Could not get video sample");
      return NULL;
    }

  /* The buffer remains valid as long as sample is valid */
  if ((buffer = gst_sample_get_buffer (sample)) && 
      (memory = gst_buffer_get_memory (buffer, 0)) &&
      gst_memory_map (memory, &info, GST_MAP_READ))
    {
      /* Create pixbuf from data with custom destroy function to free sample */
      retval = gdk_pixbuf_new_from_data (info.data,
                                         GDK_COLORSPACE_RGB, FALSE, 8,
                                         width, height,
                                         GST_ROUND_UP_4 (width * 3),
                                         sushi_media_bin_free_pixbuf,
                                         sample);
      gst_memory_unmap (memory, &info);
    }
  else
    {
      g_warning ("Could not map memory from sample");
      gst_sample_unref (sample);
    }

  gst_memory_unref (memory);

  return retval;
}
