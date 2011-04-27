let Constants = imports.util.constants;

function getScaledSize(baseSize, allocSize, upscale) {
    let allocW = allocSize[0];
    let allocH = allocSize[1];
    let width = baseSize[0];
    let height = baseSize[1];
    let scale = 1.0;

    if (((width <= allocW && height <= allocH) && upscale) ||
        (width > allocW && height > allocH)) {
        /* up/downscale both directions */
        if (width > height)
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
