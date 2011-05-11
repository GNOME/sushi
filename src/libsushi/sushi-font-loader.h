#ifndef __SUSHI_FONT_LOADER_H__
#define __SUSHI_FONT_LOADER_H__

#include <ft2build.h>
#include FT_FREETYPE_H
#include <gio/gio.h>

void sushi_new_ft_face_from_uri_async (const gchar *uri,
                                       GAsyncReadyCallback callback,
                                       gpointer user_data);

FT_Face sushi_new_ft_face_from_uri_finish (GAsyncResult *result,
                                           gchar **contents,
                                           GError **error);

#endif /* __SUSHI_FONT_LOADER_H__ */
