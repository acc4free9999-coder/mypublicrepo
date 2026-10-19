export function imageSource(image) {
  const value = image.currentSrc || image.getAttribute("src");
  if (!value) throw new Error("A conversation image has no source. Scroll it into view and retry.");
  const url = new URL(value, image.ownerDocument.baseURI);
  if (!["https:", "blob:", "data:"].includes(url.protocol)) {
    throw new Error("Unsupported image URL. Export from the live HTTPS ChatGPT page.");
  }
  return url.href;
}
