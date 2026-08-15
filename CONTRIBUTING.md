# Contributing to Sushi

## Running

After starting, you can preview files from Nautilus by pressing <kbd>Spacebar</kbd> (requires Nautilus >= 51). \
For older versions or if you have a system installation of Sushi, you can use the NautilusDevel nightly flatpak.

### Directly from the build directory
```sh
$ meson setup -Dprofile=development builddir
$ ninja -C builddir devel
```

### Using Foundry

```sh
foundry run -- env SUSHI_PERSIST=1 /app/libexec/org.gnome.NautilusPreviewerDevel
```

### From Builder

After opening the project in Builder, do the following:
1. Make sure that your active configuration is `org.gnome.NautilusPreviewer.json`.
2. Go to "Configure Project..." (<kbd>Ctrl</kbd> + <kbd>,</kbd>) → "Commands"
3. Create a new command: \
   **Shell Command:** `/app/libexec/org.gnome.NautilusPreviewerDevel` \
   **Add variable:** `SUSHI_PERSIST=1`
4. Go to "Application" and change the "Run Command" to your newly created command.

Now you can start Sushi from Builder.

## Find Leaks
GJS provides a [script to analyse heap dumps](https://gitlab.gnome.org/GNOME/gjs/-/blob/master/tools/heapgraph.md).
Automatic heap dumping can be activated by setting `SUSHI_DUMP_INTERVAL_S` to an interval at which sushi should do so.
The heap dumps will be placed in `/tmp/sushi-dumps` and can be analyzed with the `heapgraph.py` script.
An example that shows the difference between two app states:

```sh
python3 heapgraph.py --no-gray-roots --no-weak-maps --diff-heap /tmp/sushi-dumps/sushi1.heap /tmp/sushi-dumps/sushi2.heap GObject
```

More information on memory management in GJS can be found at <https://gjs.guide/guides/gjs/memory-management.html>
