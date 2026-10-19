import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { canvasPng, createArchive, screenshotFilename } from "../src/archive.js";

const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMZkAAAAASUVORK5CYII=", "base64",
));

test("ZIP contains ordered, losslessly stored PNG screenshots", async () => {
  const blob = createArchive([png, png, png]);
  assert.equal(blob.type, "application/zip");
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ["conversation-00001.png", "conversation-00002.png", "conversation-00003.png"]);
  for (const bytes of Object.values(files)) assert.deepEqual(bytes, png);
  assert.equal(screenshotFilename(10000), "conversation-10000.png");
});

test("empty captures, invalid PNGs, and invalid numbering produce explicit errors", () => {
  assert.throws(() => createArchive([]), /No conversation screenshots/);
  assert.throws(() => createArchive([new Uint8Array(8)]), /not a PNG/);
  for (const index of [0, -1, 1.5]) assert.throws(() => screenshotFilename(index), /Invalid/);
});

test("canvas encoding returns PNG bytes and reports null-blob failures", async () => {
  const bytes = await canvasPng({ toBlob: (callback, format) => {
    assert.equal(format, "image/png");
    callback(new Blob([png], { type: format }));
  } });
  assert.deepEqual(bytes, png);
  await assert.rejects(canvasPng({ toBlob: (callback) => callback(null) }), /Could not encode/);
});
