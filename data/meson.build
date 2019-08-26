dbus_conf = configuration_data()

dbus_conf.set('libexecdir', libexecdir)

configure_file(
  input: 'org.gnome.NautilusPreviewer.service.in',
  output: 'org.gnome.NautilusPreviewer.service',
  configuration: dbus_conf,
  install_dir: join_paths(datadir, 'dbus-1', 'services'),
)

i18n.merge_file(
  input: 'org.gnome.NautilusPreviewer.appdata.xml.in',
  output: 'org.gnome.NautilusPreviewer.appdata.xml',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(datadir, 'metainfo')
)

install_data(
  'builder-dark.style-scheme.xml',
  install_dir: join_paths(pkgdatadir, 'gtksourceview-4/styles')
)
