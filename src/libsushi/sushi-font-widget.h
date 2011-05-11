#ifndef __SUSHI_FONT_WIDGET_H__
#define __SUSHI_FONT_WIDGET_H__

#include <glib-object.h>
#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_FONT_WIDGET            (sushi_font_widget_get_type ())
#define SUSHI_FONT_WIDGET(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_FONT_WIDGET, SushiFontWidget))
#define SUSHI_IS_FONT_WIDGET(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_FONT_WIDGET))
#define SUSHI_FONT_WIDGET_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_FONT_WIDGET, SushiFontWidgetClass))
#define SUSHI_IS_FONT_WIDGET_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_FONT_WIDGET))
#define SUSHI_FONT_WIDGET_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_FONT_WIDGET, SushiFontWidgetClass))

typedef struct _SushiFontWidget          SushiFontWidget;
typedef struct _SushiFontWidgetPrivate   SushiFontWidgetPrivate;
typedef struct _SushiFontWidgetClass     SushiFontWidgetClass;

struct _SushiFontWidget
{
  GtkDrawingArea parent_instance;

  SushiFontWidgetPrivate *priv;
};

struct _SushiFontWidgetClass
{
  GtkDrawingAreaClass parent_class;
};

GType    sushi_font_widget_get_type     (void) G_GNUC_CONST;

SushiFontWidget *sushi_font_widget_new (const gchar *uri);

G_END_DECLS

#endif /* __SUSHI_FONT_WIDGET_H__ */
