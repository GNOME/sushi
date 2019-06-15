dbus_conf = configuration_data()

dbus_conf.set('libexecdir', libexecdir)

configure_file(
  input: 'org.gnome.NautilusPreviewer.service.in',
  output: 'org.gnome.NautilusPreviewer.service',
  configuration: dbus_conf,
  install_dir: join_paths(datadir, 'dbus-1', 'services'),
)
