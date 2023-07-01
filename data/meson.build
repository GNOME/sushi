conf = configuration_data()

conf.set('libexecdir', libexecdir)
conf.set('app_id', app_id)

configure_file(
  input: 'org.gnome.NautilusPreviewer.service.in',
  output: '@0@.service'.format(app_id),
  configuration: conf,
  install_dir: join_paths(datadir, 'dbus-1', 'services'),
)

i18n.merge_file(
  input: configure_file(
    input: 'org.gnome.NautilusPreviewer.appdata.xml.in.in',
    output: '@BASENAME@',
    configuration: conf
  ),
  output: '@0@.appdata.xml'.format(app_id),
  po_dir: '../po',
  install: true,
  install_dir: join_paths(datadir, 'metainfo')
)

install_data(
  'builder-dark.style-scheme.xml',
  install_dir: join_paths(pkgdatadir, 'gtksourceview-4/styles')
)
