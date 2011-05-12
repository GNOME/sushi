let Constants = imports.util.constants;

let slowDownFactor = 0;

function setSlowDownFactor(factor) {
    slowDownFactor = factor;
}

function getScaledSize(baseSize, allocSize, upscale) {
    let allocW = allocSize[0];
    let allocH = allocSize[1];
    let width = baseSize[0];
    let height = baseSize[1];
    let scale = 1.0;

    if (((width <= allocW && height <= allocH) && upscale) ||
        (width > allocW && height > allocH)) {
        /* up/downscale both directions */
        let allocRatio = allocW / allocH;
        let baseRatio = width / height;

        if (baseRatio > allocRatio)
            scale = allocW / width;
        else
            scale = allocH / height;
    } else if (width > allocW &&
               height <= allocH) {
        /* downscale x */
        scale = allocW / width;
    } else if (width <= allocW &&
               height > allocH) {
        /* downscale y */
        scale = allocH / height;
    }

    width *= scale;
    height *= scale;

    return [ Math.floor(width), Math.floor(height) ];
}

function getStaticSize(renderer, widget) {
    let width = widget.get_preferred_width()[1];
    let height = widget.get_preferred_height()[1];

    if (width < Constants.VIEW_MIN &&
        height < Constants.VIEW_MIN) {
        width = Constants.VIEW_MIN;
    }

    /* never make it shrink; this could happen when the
     * spinner hides.
     */
    if (width < renderer.lastWidth)
        width = renderer.lastWidth;
    else
        renderer.lastWidth = width;

    if (height < renderer.lastHeight)
        height = renderer.lastHeight;
    else
        renderer.lastHeight = height;

    /* return the natural */
    return [ width, height ];
}

function createFullScreenButton(mainWindow) {
    let toolbarZoom = new Gtk.ToolButton({ expand: false,
                                           "icon-name": "view-fullscreen-symbolic" });
    toolbarZoom.show();
    toolbarZoom.connect("clicked",
                        function () {
                            mainWindow.toggleFullScreen();
                        });

    return toolbarZoom;
}

function createRunButton(file) {
    let toolbarRun = new Gtk.ToolButton({ expand: false,
                                          "icon-name": "system-run-symbolic" });
    toolbarRun.show();
    toolbarRun.connect("clicked",
                       function () {
                           let timestamp = Gtk.get_current_event_time();
                           try {
                               Gtk.show_uri(toolbarRun.get_screen(),
                                            file.get_uri(),
                                            timestamp);
                           } catch (e) {
                           }
                       });

    return toolbarRun;
}

function formatTimeString(timeVal) {
    let hours = Math.floor(timeVal / 3600);
    timeVal -= hours * 3600;

    let minutes = Math.floor(timeVal / 60);
    timeVal -= minutes * 60;

    let seconds = Math.floor(timeVal);

    let str = ("%02d:%02d").format(minutes, seconds);
    if (hours > 0) {
        current = ("%d").format(hours) + ":" + current;
    }

    return str;
}
