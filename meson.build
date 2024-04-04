project(
  'sushi',
  'c',
  version: '47.alpha',
  meson_version: '>=0.58.0'
)

epoxy_dep = dependency('epoxy')
evince_document_dep = dependency('evince-document-3.0')
evince_view_dep = dependency('evince-view-3.0')
freetype_dep = dependency('freetype2')
gdk_pixbuf_dep = dependency('gdk-pixbuf-2.0', version: '>=2.23.0')
gio_unix_dep = dependency('gio-unix-2.0', version: '>=2.29.14')
glib_dep = dependency('glib-2.0', version: '>=2.29.14')
gstreamer_dep = dependency('gstreamer-1.0')
gstreamer_audio_dep = dependency('gstreamer-audio-1.0')
gstreamer_tag_dep = dependency('gstreamer-tag-1.0')
gstreamer_video_dep = dependency('gstreamer-video-1.0')
gtk_dep = dependency('gtk+-3.0', version: '>=3.13.2')
gtk_x11_dep = dependency('gtk+-x11-3.0', required: get_option('X11'))
gtk_wayland_dep = dependency('gtk+-wayland-3.0', version: '>= 3.21.5', required: get_option('wayland'))
gtksourceview_dep = dependency('gtksourceview-4', version: '>=4.0.3')
harfbuzz_dep = dependency('harfbuzz', version: '>=0.9.9')
webkit_dep = dependency('webkit2gtk-4.1', required: false)

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
