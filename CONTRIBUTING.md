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
foundry run -- env SUSHI_HOLD=1 /app/libexec/org.gnome.NautilusPreviewerDevel
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
