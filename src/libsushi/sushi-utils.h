#ifndef __SUSHI_UTILS_H__
#define __SUSHI_UTILS_H__

#include <clutter/clutter.h>
#include <evince-document.h>
#include <gdk/gdk.h>

G_BEGIN_DECLS

ClutterActor * sushi_create_rounded_background (void);
GdkWindow *    sushi_create_foreign_window (guint xid);
gchar **       sushi_query_supported_document_types (void);

G_END_DECLS

#endif /* __SUSHI_UTILS_H__ */
