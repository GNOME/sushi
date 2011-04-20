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
GdkPixbuf *sushi_file_loader_get_icon     (SushiFileLoader *self);

void sushi_file_loader_stop (SushiFileLoader *self);

G_END_DECLS

#endif /* __SUSHI_FILE_LOADER_H__ */
