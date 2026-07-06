libsushi_webprocess_extension_sources = [
  'main.c',
  'sushi-web-process-extension.c',
]

libsushi_webprocess_extension = shared_module(
  'sushiwebprocessextension',
  dependencies: [webkit_webprocess_extension],
  sources: [libsushi_webprocess_extension_sources],
  install: true,
  install_dir: web_process_extensions_dir,
  install_rpath: pkglibdir,
)
