project(
  'sushi',
  'c',
  version: '47.alpha',
  meson_version: '>=0.58.0'
)

papers_document_dep = dependency('papers-document-4.0')
papers_view_dep = dependency('papers-view-4.0')
freetype_dep = dependency('freetype2')
gdk_pixbuf_dep = dependency('gdk-pixbuf-2.0', version: '>=2.23.0')
gio_unix_dep = dependency('gio-unix-2.0', version: '>=2.29.14')
glib_dep = dependency('glib-2.0', version: '>=2.29.14')
gstreamer_dep = dependency('gstreamer-1.0')
gstreamer_tag_dep = dependency('gstreamer-tag-1.0')
gst_pbutils_dep = dependency('gstreamer-pbutils-1.0')
gtk_wayland_dep = dependency('gtk4-wayland', required: get_option('wayland'))
gtk_x11_dep = dependency('gtk4-x11', required: get_option('X11'))
gtk_dep = dependency('gtk4', version: '>= 4.10')
gtksourceview_dep = dependency('gtksourceview-5')
harfbuzz_dep = dependency('harfbuzz', version: '>=0.9.9')
webkit_dep = dependency('webkitgtk-6.0')
x11_dep = dependency('x11', required: get_option('X11'))
libadwaita_dep = dependency('libadwaita-1')

bindir = join_paths(get_option('prefix'), get_option('bindir'))
datadir = join_paths(get_option('prefix'), get_option('datadir'))
libdir = join_paths(get_option('prefix'), get_option('libdir'))
libexecdir = join_paths(get_option('prefix'), get_option('libexecdir'))
pkgdatadir = join_paths(datadir, meson.project_name())
pkglibdir = join_paths(libdir, meson.project_name())
gjs = find_program('gjs', 'gjs-console')

add_project_arguments(
  '-DGETTEXT_PACKAGE="' + meson.project_name() + '"',
  language: 'c',
)

if get_option('profile') == 'default'
  app_id = 'org.gnome.NautilusPreviewer'
else
  app_id = 'org.gnome.NautilusPreviewerDevel'
endif

object_path = '/@0@'.format(app_id.replace('.', '/'))

i18n = import('i18n')

subdir('data')
subdir('po')
subdir('src')
