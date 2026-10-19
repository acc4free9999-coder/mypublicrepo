import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/exporter.js", "src/popup.js", "src/background.js"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  legalComments: "eof",
});
await Promise.all(
  ["popup.html", "popup.css"].map((file) =>
    copyFile(file, `dist/${file}`),
  ),
);
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
manifest.action.default_popup = "popup.html";
manifest.background.service_worker = "background.js";
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Extension built in dist/. Load this folder in chrome://extensions.");
