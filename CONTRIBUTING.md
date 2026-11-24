# Contributing to Sushi

Commit messages should follow the format [explained in the handbook](https://handbook.gnome.org/development/commit-messages.html)

## Running

After starting, you can preview files from Nautilus by pressing <kbd>Spacebar</kbd> (requires Nautilus >= 51). \
For older versions or if you have a system installation of Sushi, you can use the NautilusDevel nightly flatpak.

### Directly from the build directory
```sh
$ meson setup -Dprofile=development builddir
$ meson compile -C builddir devel
```

### Using Foundry

```sh
foundry run -- env SUSHI_PERSIST=1 /app/libexec/org.gnome.NautilusPreviewer.Devel
```

### From Builder

After opening the project in Builder, do the following:
1. Make sure that your active configuration is `org.gnome.NautilusPreviewer.json`.
2. Go to "Configure Project..." (<kbd>Ctrl</kbd> + <kbd>,</kbd>) → "Commands"
3. Create a new command: \
   **Shell Command:** `/app/libexec/org.gnome.NautilusPreviewer.Devel` \
   **Add variable:** `SUSHI_PERSIST=1`
4. Go to "Application" and change the "Run Command" to your newly created command.

Now you can start Sushi from Builder.

## Find Leaks

GJS writes a heap dump whenever it receives `SIGUSR1`.
Define where these heaps are created by setting `GJS_DEBUG_HEAP_OUTPUT` to a file name prefix:

```sh
mkdir -p /tmp/sushi-dumps/
GJS_DEBUG_HEAP_OUTPUT=/tmp/sushi-dumps/sushi meson compile -C builddir devel
```

Sending `SIGUSR1` to the process will create a heap dump named `<prefix>.<pid>.<n>`.
Send the signal with e.g. `pkill -USR1 -f org.gnome.NautilusPreviewer`.
With GJS's [`heapgraph.py`](https://gitlab.gnome.org/GNOME/gjs/-/blob/master/tools/heapgraph.md)
two heap dumps can be compared.
Objects that are still reachable in the second dump but not in the first are (most likely) leaked.

```sh
$ python3 heapgraph.py --no-gray-roots --no-weak-maps --diff-heap /tmp/sushi-dumps/sushi.<pid>.0 /tmp/sushi-dumps/sushi.<pid>.1 GObject
```

When running in a Flatpak sandbox (Foundry, Builder), pass `GJS_DEBUG_HEAP_OUTPUT` the same way as
`SUSHI_PERSIST` (see above) and pick a directory that you can reach from the host.

More information on memory management in GJS can be found at <https://gjs.guide/guides/gjs/memory-management.html>
