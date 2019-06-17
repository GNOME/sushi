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

#ifndef __SUSHI_SOUND_PLAYER_H__
#define __SUSHI_SOUND_PLAYER_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_SOUND_PLAYER sushi_sound_player_get_type ()
G_DECLARE_FINAL_TYPE (SushiSoundPlayer, sushi_sound_player, SUSHI, SOUND_PLAYER, GObject)

typedef enum
{
  SUSHI_SOUND_PLAYER_STATE_UNKNOWN = 0,
  SUSHI_SOUND_PLAYER_STATE_IDLE    = 1,
  SUSHI_SOUND_PLAYER_STATE_PLAYING = 2,
  SUSHI_SOUND_PLAYER_STATE_DONE    = 3,
  SUSHI_SOUND_PLAYER_STATE_ERROR   = 4
} SushiSoundPlayerState;

G_END_DECLS

#endif /* __SUSHI_SOUND_PLAYER_H__ */
