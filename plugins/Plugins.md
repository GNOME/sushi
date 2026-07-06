# Plugins
Sushi can be extended with plugins to provide preview support for additional file types.
Desired plugins can be installed by placing them under `$HOME/.local/share/sushi/plugins-1`.
They will automatically be used the next time sushi is started.

## Developers
See the `example.js` file for a basic plugin skeleton.
You can also look at other renderers under `src/viewers/`, e.g. `image.js` implements delayed loading and a custom size.

## Note On Compatibility
In version 51 the plugin directory was changed, as previous plugins become incompatible with the port to GTK4.
For version 50 and before plugins were placed in `$HOME/.local/share/sushi/viewers`.
