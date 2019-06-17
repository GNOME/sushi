/*
 * Copyright (C) 2011 Lucas Rocha <lucasr@gnome.org>
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
 * Authors: Lucas Rocha <lucasr@gnome.org>
 *
 */

#include <glib.h>
#include <glib-object.h>

#include <gst/gst.h>
#include <gst/pbutils/pbutils.h>

#include "sushi-enum-types.h"
#include "sushi-sound-player.h"

struct _SushiSoundPlayer {
  GstElement            *pipeline;
  GstBus                *bus;
  SushiSoundPlayerState     state;
  char                  *uri;
  gboolean               playing;
  GstState               stacked_state;
  gdouble                stacked_progress;
  gdouble                target_progress;
  gdouble                duration;
  guint                  tick_timeout_id;

  GstDiscoverer         *discoverer;
  GstTagList            *taglist;

  guint                  in_seek : 1;
};

G_DEFINE_TYPE (SushiSoundPlayer, sushi_sound_player, G_TYPE_OBJECT)

#define TICK_TIMEOUT 0.5

enum
{
  PROP_0,

  PROP_PLAYING,
  PROP_STATE,
  PROP_PROGRESS,
  PROP_DURATION,
  PROP_URI,
  PROP_TAGLIST
};

static void sushi_sound_player_destroy_pipeline (SushiSoundPlayer *player);
static gboolean sushi_sound_player_ensure_pipeline (SushiSoundPlayer *player);

static void
sushi_sound_player_set_state (SushiSoundPlayer      *player,
                              SushiSoundPlayerState  state)
{
  g_return_if_fail (SUSHI_IS_SOUND_PLAYER (player));

  if (player->state == state)
    return;

  player->state = state;

  g_object_notify (G_OBJECT (player), "state");
}


static void
sushi_sound_player_destroy_discoverer (SushiSoundPlayer *player)
{
  if (player->discoverer == NULL)
    return;

  if (player->taglist != NULL) {
    gst_tag_list_free (player->taglist);
    player->taglist = NULL;
  }

  gst_discoverer_stop (player->discoverer);
  gst_object_unref (player->discoverer);
  player->discoverer = NULL;

  g_object_notify (G_OBJECT (player), "taglist");

  g_clear_object (&player->taglist);
}

static void
discoverer_discovered_cb (GstDiscoverer *disco,
                          GstDiscovererInfo *info,
                          GError *error,
                          gpointer user_data)
{
  SushiSoundPlayer *player = user_data;
  const GstTagList *taglist;

  if (error != NULL)
    return;

  taglist = gst_discoverer_info_get_tags (info);

  if (taglist)
    {
      player->taglist = gst_tag_list_copy (taglist);
      g_object_notify (G_OBJECT (player), "taglist");
    }
}

static gboolean
sushi_sound_player_ensure_discoverer (SushiSoundPlayer *player)
{
  if (player->discoverer)
    return TRUE;

  player->discoverer = gst_discoverer_new (GST_SECOND * 60,
                                         NULL);

  if (player->discoverer == NULL)
    return FALSE;

  g_signal_connect (player->discoverer, "discovered",
                    G_CALLBACK (discoverer_discovered_cb), player);
  gst_discoverer_start (player->discoverer);
  gst_discoverer_discover_uri_async (player->discoverer, player->uri);

  return TRUE;
}

static void
sushi_sound_player_set_uri (SushiSoundPlayer *player,
                            const char    *uri)
{
  g_return_if_fail (SUSHI_IS_SOUND_PLAYER (player));

  if (!g_strcmp0 (player->uri, uri))
    return;

  g_free (player->uri);
  player->uri = g_strdup (uri);

  if (player->pipeline)
    sushi_sound_player_destroy_pipeline (player);

  if (player->discoverer)
    sushi_sound_player_destroy_discoverer (player);

  sushi_sound_player_ensure_pipeline (player);
  sushi_sound_player_ensure_discoverer (player);

  g_object_notify (G_OBJECT (player), "uri");
}

static void
sushi_sound_player_set_progress (SushiSoundPlayer *player,
                                 gdouble        progress)
{
  GstState pending;
  GstQuery *duration_q;
  gint64 position;

  if (!player->pipeline)
    return;

  player->target_progress = progress;

  if (player->in_seek)
    {
      player->stacked_progress = progress;
      return;
    }

  gst_element_get_state (player->pipeline, &player->stacked_state, &pending, 0);

  if (pending)
    player->stacked_state = pending;

  gst_element_set_state (player->pipeline, GST_STATE_PAUSED);

  duration_q = gst_query_new_duration (GST_FORMAT_TIME);

  if (gst_element_query (player->pipeline, duration_q))
    {
      gint64 duration = 0;

      gst_query_parse_duration (duration_q, NULL, &duration);

      position = progress * duration;
    }
  else
    position = 0;

  gst_query_unref (duration_q);

  gst_element_seek (player->pipeline,
		    1.0,
		    GST_FORMAT_TIME,
		    GST_SEEK_FLAG_FLUSH,
		    GST_SEEK_TYPE_SET,
		    position,
		    GST_SEEK_TYPE_NONE, GST_CLOCK_TIME_NONE);

  player->in_seek = TRUE;
  player->stacked_progress = 0.0;
}

static gdouble
sushi_sound_player_get_progress (SushiSoundPlayer *player)
{
  GstQuery *position_q, *duration_q;
  gdouble progress;

  if (!player->pipeline)
    return 0.0;

  if (player->in_seek)
    {
      return player->target_progress;
    }

  position_q = gst_query_new_position (GST_FORMAT_TIME);
  duration_q = gst_query_new_duration (GST_FORMAT_TIME);

  if (gst_element_query (player->pipeline, position_q) &&
      gst_element_query (player->pipeline, duration_q))
    {
      gint64 position, duration;

      position = duration = 0;

      gst_query_parse_position (position_q, NULL, &position);
      gst_query_parse_duration (duration_q, NULL, &duration);

      progress = CLAMP ((gdouble) position / (gdouble) duration, 0.0, 1.0);
    }
  else
    progress = 0.0;

  gst_query_unref (position_q);
  gst_query_unref (duration_q);

  return progress;
}

static void
sushi_sound_player_query_duration (SushiSoundPlayer *player)
{
  gdouble new_duration, difference;
  gint64 duration;

  if (!gst_element_query_duration (player->pipeline, GST_FORMAT_TIME, &duration))
    return;

  new_duration = (gdouble) duration / GST_SECOND;

  difference = ABS (player->duration - new_duration);

  if (difference > 1e-3)
    {
      player->duration = new_duration;

      if (difference > 1.0)
        g_object_notify (G_OBJECT (player), "duration");
    }
}

static void
sushi_sound_player_reset_pipeline (SushiSoundPlayer *player)
{
  GstState state, pending;
  GstMessage *msg;

  if (!player->pipeline)
    return;

  gst_element_get_state (player->pipeline, &state, &pending, 0);

  if (state == GST_STATE_NULL && pending == GST_STATE_VOID_PENDING)
    {
      return;
    }
  else if (state == GST_STATE_NULL && pending != GST_STATE_VOID_PENDING)
    {
      gst_element_set_state (player->pipeline, GST_STATE_NULL);
      return;
    }

  gst_element_set_state (player->pipeline, GST_STATE_READY);
  gst_element_get_state (player->pipeline, NULL, NULL, -1);

  while ((msg = gst_bus_pop (player->bus)))
    gst_bus_async_signal_func (player->bus, msg, NULL);

  gst_element_set_state (player->pipeline, GST_STATE_NULL);

  g_object_notify (G_OBJECT (player), "duration");
  g_object_notify (G_OBJECT (player), "progress");
}

static void
sushi_sound_player_destroy_pipeline (SushiSoundPlayer *player)
{
  if (player->bus)
    {
      gst_bus_set_flushing (player->bus, TRUE);
      gst_bus_remove_signal_watch (player->bus);

      gst_object_unref (player->bus);
      player->bus = NULL;
    }

  if (player->pipeline)
    {
      gst_element_set_state (player->pipeline, GST_STATE_NULL);

      gst_object_unref (player->pipeline);
      player->pipeline = NULL;
    }

  if (player->tick_timeout_id != 0)
    {
      g_source_remove (player->tick_timeout_id);
      player->tick_timeout_id = 0;
    }

  g_object_notify (G_OBJECT (player), "duration");
  g_object_notify (G_OBJECT (player), "progress");
}

static gboolean
sushi_sound_player_tick_timeout (gpointer user_data)
{
  GObject *player = user_data;

  g_object_notify (player, "progress");

  return TRUE;
}

static void
sushi_sound_player_on_state_changed (GstBus        *bus,
                                  GstMessage    *msg,
                                  SushiSoundPlayer *player)
{
  GstState state, old_state;

  g_return_if_fail (SUSHI_IS_SOUND_PLAYER (player));

  if (msg->src != GST_OBJECT (player->pipeline))
    return;

  gst_message_parse_state_changed (msg, &old_state, &state, NULL);

  if (state == GST_STATE_PAUSED && old_state == GST_STATE_READY)
    sushi_sound_player_query_duration (player);

  switch (state)
    {
    case GST_STATE_PLAYING:
      sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_PLAYING);

      if (player->tick_timeout_id == 0)
        {
          player->tick_timeout_id =
            g_timeout_add (TICK_TIMEOUT * 1000,
                           sushi_sound_player_tick_timeout,
                           player);
        }
      break;

    case GST_STATE_READY:
    case GST_STATE_PAUSED:
      sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_IDLE);

      if (player->tick_timeout_id != 0)
        {
          g_source_remove (player->tick_timeout_id);
          player->tick_timeout_id = 0;
        }
      break;

    default:
      /* Do nothing */
      break;
    }
}

static void
sushi_sound_player_on_error (GstBus        *bus,
                          GstMessage    *msg,
                          SushiSoundPlayer *player)
{
  sushi_sound_player_reset_pipeline (player);
  sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_ERROR);
}

static void
sushi_sound_player_on_eos (GstBus        *bus,
                        GstMessage    *msg,
                        SushiSoundPlayer *player)
{
  g_object_notify (G_OBJECT (player), "progress");

  sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_DONE);
  sushi_sound_player_reset_pipeline (player);
}

static void
sushi_sound_player_on_async_done (GstBus        *bus,
                               GstMessage    *msg,
                               SushiSoundPlayer *player)
{
  if (player->in_seek)
    {
      g_object_notify (G_OBJECT (player), "progress");

      player->in_seek = FALSE;
      gst_element_set_state (player->pipeline, player->stacked_state);

      if (player->stacked_progress)
        {
          sushi_sound_player_set_progress (player, player->stacked_progress);
        }
    }
}

static void
sushi_sound_player_on_duration (GstBus        *bus,
                                GstMessage    *msg,
                                SushiSoundPlayer *player)
{
  gint64 duration;

  gst_message_parse_duration (msg, NULL, &duration);

  if (G_UNLIKELY (duration != GST_CLOCK_TIME_NONE))
    return;

  sushi_sound_player_query_duration (player);
}

static gboolean
sushi_sound_player_ensure_pipeline (SushiSoundPlayer *player)
{
  GError *error;
  gchar *pipeline_desc;

  if (player->pipeline)
    return TRUE;

  if (player->uri == NULL)
    {
      sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_ERROR);
      return FALSE;
    }

  error = NULL;

  pipeline_desc = g_strdup_printf("playbin uri=\"%s\"",
                                  player->uri);

  player->pipeline = gst_parse_launch (pipeline_desc, &error);

  g_free (pipeline_desc);

  if (error)
    {
      g_error_free (error);
      player->pipeline = NULL;

      sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_ERROR);
      return FALSE;
    }

  if (!gst_element_set_state (player->pipeline, GST_STATE_READY))
    {
      g_object_unref (player->pipeline);
      player->pipeline = NULL;

      sushi_sound_player_set_state (player, SUSHI_SOUND_PLAYER_STATE_ERROR);
      return FALSE;
    }

  player->bus = gst_element_get_bus (player->pipeline);

  gst_bus_add_signal_watch (player->bus);

  g_signal_connect (player->bus,
                    "message::state-changed",
                    G_CALLBACK (sushi_sound_player_on_state_changed),
                    player);

  g_signal_connect (player->bus,
                    "message::error",
                    G_CALLBACK (sushi_sound_player_on_error),
                    player);

  g_signal_connect (player->bus,
                    "message::eos",
                    G_CALLBACK (sushi_sound_player_on_eos),
                    player);

  g_signal_connect (player->bus,
                    "message::async-done",
                    G_CALLBACK (sushi_sound_player_on_async_done),
                    player);

  g_signal_connect (player->bus,
                    "message::duration",
                    G_CALLBACK (sushi_sound_player_on_duration),
                    player);

  /* Pause pipeline so that the file duration becomes
   * available as soon as possible */
  gst_element_set_state (player->pipeline, GST_STATE_PAUSED);

  return TRUE;
}

void
sushi_sound_player_set_playing (SushiSoundPlayer *player,
                             gboolean       playing)
{
  GstState state;

  g_return_if_fail (SUSHI_IS_SOUND_PLAYER (player));

  if (playing)
    state = GST_STATE_PLAYING;
  else
    state = GST_STATE_PAUSED;

  if (sushi_sound_player_ensure_pipeline (player))
    gst_element_set_state (player->pipeline, state);

  g_object_notify (G_OBJECT (player), "playing");
  g_object_notify (G_OBJECT (player), "progress");
}

static gboolean
sushi_sound_player_get_playing (SushiSoundPlayer *player)
{
  GstState state, pending;
  gboolean playing;

  g_return_val_if_fail (SUSHI_IS_SOUND_PLAYER (player), FALSE);

  if (!player->pipeline)
    return FALSE;

  gst_element_get_state (player->pipeline, &state, &pending, 0);

  if (pending)
    playing = (pending == GST_STATE_PLAYING);
  else
    playing = (state == GST_STATE_PLAYING);

  return playing;
}

static void
sushi_sound_player_finalize (GObject *gobject)
{
  G_OBJECT_CLASS (sushi_sound_player_parent_class)->finalize (gobject);
}

static void
sushi_sound_player_dispose (GObject *gobject)
{
  sushi_sound_player_destroy_pipeline (SUSHI_SOUND_PLAYER (gobject));
  sushi_sound_player_destroy_discoverer (SUSHI_SOUND_PLAYER (gobject));

  G_OBJECT_CLASS (sushi_sound_player_parent_class)->dispose (gobject);
}

static void
sushi_sound_player_get_property (GObject    *gobject,
                                 guint       prop_id,
                                 GValue     *value,
                                 GParamSpec *pspec)
{
  SushiSoundPlayer *player;
  
  player = SUSHI_SOUND_PLAYER (gobject);

  switch (prop_id)
    {
    case PROP_PLAYING:
      g_value_set_boolean (value,
                           sushi_sound_player_get_playing (player));
      break;

    case PROP_STATE:
      g_value_set_enum (value, player->state);
      break;

    case PROP_PROGRESS:
      g_value_set_double (value,
                          sushi_sound_player_get_progress (player));
      break;

    case PROP_DURATION:
      g_value_set_double (value, player->duration);
      break;

    case PROP_URI:
      g_value_set_string (value, player->uri);
      break;

    case PROP_TAGLIST:
      g_value_set_boxed (value, player->taglist);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
sushi_sound_player_set_property (GObject      *gobject,
                                 guint         prop_id,
                                 const GValue *value,
                                 GParamSpec   *pspec)
{
  SushiSoundPlayer *player = SUSHI_SOUND_PLAYER (gobject);

  switch (prop_id)
    {
    case PROP_PLAYING:
      sushi_sound_player_set_playing (player,
                                      g_value_get_boolean (value));
      break;

    case PROP_PROGRESS:
      sushi_sound_player_set_progress (player,
                                       g_value_get_double (value));
      break;

    case PROP_URI:
      sushi_sound_player_set_uri (player,
                                  g_value_get_string (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
sushi_sound_player_class_init (SushiSoundPlayerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->get_property = sushi_sound_player_get_property;
  gobject_class->set_property = sushi_sound_player_set_property;
  gobject_class->dispose = sushi_sound_player_dispose;
  gobject_class->finalize = sushi_sound_player_finalize;

  g_object_class_install_property
                 (gobject_class,
                  PROP_PLAYING,
                  g_param_spec_boolean ("playing",
                                        "Playing",
                                        "Whether player is playing or not",
                                        FALSE,
                                        G_PARAM_READWRITE));

  g_object_class_install_property
                 (gobject_class,
                  PROP_PROGRESS,
                  g_param_spec_double ("progress",
                                       "Progress",
                                       "Player's playback progress",
                                       0.0,
                                       1.0,
                                       0.0,
                                       G_PARAM_READWRITE));

  g_object_class_install_property
                 (gobject_class,
                  PROP_DURATION,
                  g_param_spec_double ("duration",
                                       "Duration",
                                       "Sound duration",
                                       0.0,
                                       G_MAXDOUBLE,
                                       0.0,
                                       G_PARAM_READABLE));

  g_object_class_install_property
                 (gobject_class,
                  PROP_STATE,
                  g_param_spec_enum ("state",
                                     "State",
                                     "State of the sound player",
                                     SUSHI_TYPE_SOUND_PLAYER_STATE,
                                     SUSHI_SOUND_PLAYER_STATE_UNKNOWN,
                                     G_PARAM_READABLE));

  g_object_class_install_property
                 (gobject_class,
                  PROP_URI,
                  g_param_spec_string ("uri",
                                       "uri",
                                       "Uri to load sound from",
                                       NULL,
                                       G_PARAM_READWRITE |
                                       G_PARAM_CONSTRUCT));

  g_object_class_install_property
    (gobject_class,
     PROP_TAGLIST,
     g_param_spec_boxed ("taglist",
                         "Taglist",
                         "Taglist for the current URI",
                         GST_TYPE_TAG_LIST,
                         G_PARAM_READABLE));
}

static void
sushi_sound_player_init (SushiSoundPlayer *player)
{
  player->state = SUSHI_SOUND_PLAYER_STATE_UNKNOWN;
  player->playing = FALSE;
  player->uri = NULL;
  player->pipeline = NULL;
  player->bus = NULL;
  player->stacked_progress = 0.0;
  player->duration = 0.0;
  player->tick_timeout_id = 0;
}
