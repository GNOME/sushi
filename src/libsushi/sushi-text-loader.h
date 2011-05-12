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
