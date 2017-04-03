gnome = import('gnome')

sushi_sources = [
  'main.c',
]

deps = [
  epoxy_dep,
  evince_document_dep,
  evince_view_dep,
  freetype_dep,
  gdk_pixbuf_dep,
  gjs_dep,
  glib_dep,
  gstreamer_dep,
  gstreamer_audio_dep,
  gstreamer_pbutils_dep,
  gstreamer_tag_dep,
  gstreamer_video_dep,
  gtk_dep,
  gtksourceview_dep,
  harfbuzz_dep,
  introspection_dep,
  musicbrainz_dep,
  webkit_dep,
]

# Compile libsushi and its introspection data
subdir('libsushi')

sushi_resources = gnome.compile_resources(
    'sushi-resources',
    'org.gnome.Sushi.gresource.xml',
    c_name: 'sushi',
)

sushi_sources += sushi_resources

executable(
  'sushi-start',
  sushi_sources,
  # link against the just built libsushi
  dependencies: libsushi_shared_link,
  install: true,
  install_dir: libexecdir,
)

conf = configuration_data()

conf.set(
  'pkgdatadir',
  join_paths(datadir, 'sushi'),
)
conf.set(
  'pkglibdir',
  join_paths(libdir, 'sushi'),
)
conf.set(
  'libexecdir',
  libexecdir,
)

sushi_bin = configure_file(
  input: 'sushi.in',
  output: 'sushi',
  configuration: conf,
)

install_data(
  sushi_bin,
  install_mode: 'rwxr-xr-x',
  install_dir: bindir,
)

# Install the Javascript components without installing path.js.in as well
install_subdir(
  'js',
  install_dir: join_paths(datadir, 'sushi'),
  exclude_files: 'util/path.js.in',
)

js_conf = configuration_data()

js_conf.set(
  'localedir',
  join_paths(datadir, 'locale'),
)

configure_file(
  input: 'js/util/path.js.in',
  output: 'path.js',
  configuration: js_conf,
  install_dir: join_paths(datadir, 'sushi', 'js', 'util'),
)
