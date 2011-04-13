#ifndef __SUSHI_PDF_LOADER_H__
#define __SUSHI_PDF_LOADER_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_PDF_LOADER            (sushi_pdf_loader_get_type ())
#define SUSHI_PDF_LOADER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_PDF_LOADER, SushiPdfLoader))
#define SUSHI_IS_PDF_LOADER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_PDF_LOADER))
#define SUSHI_PDF_LOADER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_PDF_LOADER, SushiPdfLoaderClass))
#define SUSHI_IS_PDF_LOADER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_PDF_LOADER))
#define SUSHI_PDF_LOADER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_PDF_LOADER, SushiPdfLoaderClass))

typedef struct _SushiPdfLoader          SushiPdfLoader;
typedef struct _SushiPdfLoaderPrivate   SushiPdfLoaderPrivate;
typedef struct _SushiPdfLoaderClass     SushiPdfLoaderClass;

struct _SushiPdfLoader
{
  GObject parent_instance;

  SushiPdfLoaderPrivate *priv;
};

struct _SushiPdfLoaderClass
{
  GObjectClass parent_class;
};

GType    sushi_pdf_loader_get_type     (void) G_GNUC_CONST;

G_END_DECLS

#endif /* __SUSHI_PDF_LOADER_H__ */
