#ifndef __SUSHI_SOUND_PLAYER_H__
#define __SUSHI_SOUND_PLAYER_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_SOUND_PLAYER            (sushi_sound_player_get_type ())
#define SUSHI_SOUND_PLAYER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_SOUND_PLAYER, SushiSoundPlayer))
#define SUSHI_IS_SOUND_PLAYER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_SOUND_PLAYER))
#define SUSHI_SOUND_PLAYER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_SOUND_PLAYER, SushiSoundPlayerClass))
#define SUSHI_IS_SOUND_PLAYER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_SOUND_PLAYER))
#define SUSHI_SOUND_PLAYER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_SOUND_PLAYER, SushiSoundPlayerClass))

typedef struct _SushiSoundPlayer          SushiSoundPlayer;
typedef struct _SushiSoundPlayerPrivate   SushiSoundPlayerPrivate;
typedef struct _SushiSoundPlayerClass     SushiSoundPlayerClass;

typedef enum
{
  SUSHI_SOUND_PLAYER_STATE_UNKNOWN = 0,
  SUSHI_SOUND_PLAYER_STATE_IDLE    = 1,
  SUSHI_SOUND_PLAYER_STATE_PLAYING = 2,
  SUSHI_SOUND_PLAYER_STATE_DONE    = 3,
  SUSHI_SOUND_PLAYER_STATE_ERROR   = 4
} SushiSoundPlayerState;

struct _SushiSoundPlayer
{
  GObject parent_instance;

  SushiSoundPlayerPrivate *priv;
};

struct _SushiSoundPlayerClass
{
  GObjectClass parent_class;
};

GType    sushi_sound_player_get_type     (void) G_GNUC_CONST;

G_END_DECLS

#endif /* __SUSHI_SOUND_PLAYER_H__ */
