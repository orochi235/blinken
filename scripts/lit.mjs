// Counting what a sign lights from a screenshot, which works whatever the canvas draws with: a
// WebGL or WebGPU canvas has no 2D context to read back.

/** How many pixels of `locator`'s screenshot have red above `over`, counted in `page`. */
export async function litPixels(page, locator, over = 160) {
  const png = (await locator.screenshot()).toString('base64');
  return page.evaluate(
    async ([data, min]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, img.width, img.height).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] > min) n++;
      return n;
    },
    [png, over],
  );
}
