config_data = configuration_data()
if gtk_x11_dep.found()
  config_data.set('HAVE_GTK_X11', 1)
endif
if gtk_wayland_dep.found()
  config_data.set('HAVE_GTK_WAYLAND', 1)
endif
configure_file(output: 'config.h', configuration: config_data)

externalwindow_sources = [
  'externalwindow.c',
  'externalwindow.h',
]

if gtk_x11_dep.found()
  externalwindow_sources += [
    'externalwindow-x11.c',
    'externalwindow-x11.h',
  ]
endif

if gtk_wayland_dep.found()
  externalwindow_sources += [
    'externalwindow-wayland.c',
    'externalwindow-wayland.h',
  ]
endif

libsushi_deps = [
  epoxy_dep,
  evince_document_dep,
  evince_view_dep,
  freetype_dep,
  gdk_pixbuf_dep,
  glib_dep,
  gstreamer_dep,
  gstreamer_audio_dep,
  gstreamer_tag_dep,
  gstreamer_video_dep,
  gtk_dep,
  harfbuzz_dep,
]

libsushi_sources = [
  'sushi-font-loader.c',
  'sushi-font-loader.h',
  'sushi-font-widget.c',
  'sushi-font-widget.h',
  'sushi-media-bin.c',
  'sushi-media-bin.h',
  'sushi-utils.c',
  'sushi-utils.h',
]

libsushi_resource = gnome.compile_resources(
  'sushi-lib-resources',
  'org.gnome.Libsushi.gresource.xml',
  c_name: 'sushi'
)

libsushi = shared_library(
  'sushi-1.0',
  dependencies: libsushi_deps,
  sources: [
    externalwindow_sources,
    libsushi_sources,
    libsushi_resource
  ],
  install: true,
  install_dir: pkglibdir
)

gnome.generate_gir(
  libsushi,
  sources: [
    libsushi_sources,
  ],
  nsversion: '1.0',
  namespace: 'Sushi',
  symbol_prefix: 'sushi',
  identifier_prefix: 'Sushi',
  includes: [
    'GstTag-1.0',
    'GdkPixbuf-2.0',
    'Gtk-3.0',
    'EvinceDocument-3.0',
    'EvinceView-3.0',
  ],
  install: true,
  install_dir_gir: join_paths(pkgdatadir, 'gir-1.0'),
  install_dir_typelib: join_paths(pkglibdir, 'girepository-1.0'),
)
