import { zipSync } from "fflate";

export function screenshotFilename(index) {
  if (!Number.isSafeInteger(index) || index < 1) throw new Error("Invalid screenshot number.");
  return `conversation-${String(index).padStart(5, "0")}.png`;
}

export function createArchive(screenshots) {
  if (!screenshots.length) throw new Error("No conversation screenshots were captured.");
  const files = {};
  for (const [index, screenshot] of screenshots.entries()) {
    if (!(screenshot instanceof Uint8Array) || screenshot.length < 8 ||
        ![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => screenshot[i] === value)) {
      throw new Error(`Screenshot ${index + 1} is not a PNG image.`);
    }
    files[screenshotFilename(index + 1)] = screenshot;
  }
  // PNG is already compressed; storing it avoids redundant ZIP compression.
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}

export async function canvasPng(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Could not encode a screenshot. Try exporting a shorter conversation."));
    }, "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function downloadArchive(blob, filename, document) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
