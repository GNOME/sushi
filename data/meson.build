dbus_conf = configuration_data()

dbus_conf.set(
  'bindir',
  join_paths(get_option('prefix'), get_option('bindir')),
)

configure_file(
  input: 'org.gnome.Sushi.service.in',
  output: 'org.gnome.Sushi.service',
  configuration: dbus_conf,
  install_dir: join_paths(datadir, 'dbus-1', 'services'),
)
