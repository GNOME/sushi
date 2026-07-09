# Plugins
Sushi can be extended with plugins to provide preview support for additional file types.
Desired plugins can be installed by placing them under `$HOME/.local/share/sushi/plugins-1`.
They can also be installed system-wide by placing them in `/usr/lib64/sushi/plugins-1`.
Plugins will automatically be used the next time sushi is started.

## Developers
See the `example.js` file for a basic plugin skeleton.
You can also look at other renderers under `src/viewers/`, e.g. `image.js` implements delayed loading and a custom size.

Sushi picks an appropriate previewer based on the previewed file's content type.
Each previewer derives from the `Renderer` interface, allowing to use the same API with all of them.
Noteworthy functions of `Renderer` are:
* `getCancellable` - provides a cancellable that will be cancelled if the previewer closes
* `isReady` - call to communicate the previewer is ready to be displayed
* `initialized` - call to communicate that previewer was created (not needed when `isReady` is already called)

Additionally, `Renderer` has overridable methods that get called at appropriate times:
* `stop` - To stop animations or media streams
* `cleanup` - Various cleanups, e.g. disconnect child object signals
* `resizePolicy` - See `ResizePolicy` enum
* `customSize` - Use a specific window size with `ResizePolicy.CUSTOM`
* `topBarStyle` - Whether to use a flat or a raised window headerbar style

Make sure your plugin does not keep references to itself around after getting unloaded, as this will cause memory leaks.
A common issue is with signal handlers, so it's recommended to either use
[`GObject.Object.connect_object`](https://gjs-docs.gnome.org/gjs/overrides.md#gobject-object-connect_object)
or store the signal handler ID and disconnect them in `cleanup()`.

## Note On Compatibility
In version 51 the plugin directory was changed, as previous plugins become incompatible with the port to GTK4.
For version 50 and before plugins were placed in `$HOME/.local/share/sushi/viewers`.
