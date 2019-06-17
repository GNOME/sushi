project(
  'org.gnome.NautilusPreviewer',
  'c',
  version: '3.32.0',
  meson_version: '>=0.46.0'
)

epoxy_dep = dependency('epoxy')
evince_document_dep = dependency('evince-document-3.0')
evince_view_dep = dependency('evince-view-3.0')
freetype_dep = dependency('freetype2')
gdk_pixbuf_dep = dependency('gdk-pixbuf-2.0', version: '>=2.23.0')
gio_unix_dep = dependency('gio-unix-2.0', version: '>=2.29.14')
gjs_dep = dependency('gjs-1.0', version: '>=1.38.0')
glib_dep = dependency('glib-2.0', version: '>=2.29.14')
gstreamer_dep = dependency('gstreamer-1.0')
gstreamer_audio_dep = dependency('gstreamer-audio-1.0')
gstreamer_base_dep = dependency('gstreamer-base-1.0')
gstreamer_pbutils_dep = dependency('gstreamer-pbutils-1.0')
gstreamer_tag_dep = dependency('gstreamer-tag-1.0')
gstreamer_video_dep = dependency('gstreamer-video-1.0')
gtk_dep = dependency('gtk+-3.0', version: '>=3.13.2')
gtksourceview_dep = dependency('gtksourceview-4', version: '>=4.0.3')
harfbuzz_dep = dependency('harfbuzz', version: '>=0.9.9')
introspection_dep = dependency('gobject-introspection-1.0', version: '>=1.0.1')
musicbrainz_dep = dependency('libmusicbrainz5')
webkit_dep = dependency('webkit2gtk-4.0')

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

subdir('data')
subdir('po')
subdir('src')

meson.add_install_script('meson-post-install.py', libexecdir, bindir)
