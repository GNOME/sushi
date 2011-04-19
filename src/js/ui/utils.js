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