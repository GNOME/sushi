libsushi_c = [
  'sushi-cover-art.c',
  'sushi-file-loader.c',
  'sushi-font-loader.c',
  'sushi-font-widget.c',
  'sushi-media-bin.c',
  'sushi-pdf-loader.c',
  'sushi-sound-player.c',
  'sushi-utils.c',
]

libsushi_headers = [
  'sushi-cover-art.h',
  'sushi-file-loader.h',
  'sushi-font-loader.h',
  'sushi-font-widget.h',
  'sushi-media-bin.h',
  'sushi-pdf-loader.h',
  'sushi-sound-player.h',
  'sushi-utils.h',
]

libsushi_enum = gnome.mkenums(
  'libsushi_enum',
  c_template: 'sushi-enum-types.c.in',
  h_template: 'sushi-enum-types.h.in',
  sources: libsushi_headers,
)

libsushi_resource = gnome.compile_resources(
  'sushi-lib-resources',
  'org.gnome.Libsushi.gresource.xml',
  c_name: 'sushi'
)

libsushi = shared_library(
  'sushi-1.0',
  dependencies: deps,
  sources: [
    libsushi_c,
    libsushi_enum,
    libsushi_headers,
    libsushi_resource
  ],
  install: true,
  install_dir: pkglibdir
)

gnome.generate_gir(
  libsushi,
  sources: [
    libsushi_c,
    libsushi_enum,
    libsushi_headers,
  ],
  nsversion: '1.0',
  namespace: 'Sushi',
  symbol_prefix: 'sushi',
  identifier_prefix: 'Sushi',
  includes: [
    'GstPbutils-1.0',
    'GstTag-1.0',
    'GdkPixbuf-2.0',
    'Gtk-3.0',
    'GtkSource-4',
    'EvinceDocument-3.0',
  ],
  install: true,
  install_dir_gir: join_paths(pkgdatadir, 'gir-1.0'),
  install_dir_typelib: join_paths(pkglibdir, 'girepository-1.0'),
)
