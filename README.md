# Sushi

This is Sushi, a quick previewer for Files (nautilus), the GNOME desktop file manager.

## Using Sushi

Sushi is a DBus-activated service. For Sushi to popup, applications will have to call the `ShowFile` method on the `org.gnome.NautilusPreviewer2` interface.

If you want to debug Sushi without a calling application, you can use the `sushi <filename>` command.

## Reporting issues

Before filing an issue here, confirm that it has not been fixed on the latest nightly build.  The easiest way to do this is by installing the nightly flatpak.

```
flatpak remote-add --if-not-exists gnome-nightly https://nightly.gnome.org/gnome-nightly.flatpakrepo
flatpak install gnome-nightly org.gnome.NautilusPreviewerDevel
```

After installing the nightly flatpak, you can launch Sushi via the below command, or by initiating a preview from the NautilusDevel nightly flatpak.

`flatpak run org.gnome.NautilusPreviewerDevel <filename>`
