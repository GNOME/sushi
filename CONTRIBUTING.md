# Contributing to Sushi

## Running directly from the build directory
```sh
$ meson setup -Dprofile=development builddir
$ ninja -C builddir devel
```

## Running the Flatpak from Builder

After opening the project in Builder, do the following:
1. Make sure that your active configuration is `org.gnome.NautilusPreviewer.json`.
2. Go to "Configure Project..." (<kbd>Ctrl</kbd> + <kbd>,</kbd>) → "Commands"
3. Create a new command: \
   **Shell Command:** `gjs /app/libexec/org.gnome.NautilusPreviewerDevel` \
   **Add variable:** `SUSHI_PERSIST=1`
4. Go to "Application" and change the "Run Command" to your newly created command.

Now you can start Sushi from Builder. After starting, you can preview files
from the NautilusDevel nightly flatpak.
