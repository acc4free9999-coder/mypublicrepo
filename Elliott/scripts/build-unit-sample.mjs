import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMt5 } from "./mt5.mjs";
import { diagramSvg } from "./teaching-html.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export const supported = [2300, 2340, 2320, 2390, 2350, 2410];
export const overlapping = [2300, 2340, 2320, 2390, 2335, 2410];

export function sampleFigures() {
  const folder = resolve(root, "data/Mt5Data");
  const matches = readdirSync(folder).filter((name) => /^XAUUSDm_H4_.*\.csv$/.test(name));
  if (matches.length !== 1) throw new Error(`Expected one XAUUSDm H4 export; found ${matches.length}`);
  const source = `data/Mt5Data/${matches[0]}`;
  const text = readFileSync(resolve(root, source), "utf8");
  const bars = parseMt5(text, source).filter((bar) => bar.date >= "2023-03-01").slice(0, 48);
  if (bars.length !== 48) throw new Error("Unit sample requires 48 H4 candles from March 2023.");
  const identity = {
    source,
    sha256: createHash("sha256").update(text).digest("hex"),
    timeframe: "H4",
    timezone: "MT5 server time; UTC offset unknown",
    bars
  };
  const min = Math.min(...bars.map((bar) => bar.low));
  const max = Math.max(...bars.map((bar) => bar.high));
  const span = max - min;
  if (!(span > 0)) throw new Error("Unit chart requires a nonzero price range.");
  const y = (price) => 105 + (max - price) / span * 250;
  const x = (index) => 90 + index / (bars.length - 1) * 800;
  const candleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480" viewBox="0 0 960 480" role="img" aria-labelledby="title desc">
<title id="title">Unit 04: original XAUUSDm H4 candles, independent drawing exercise</title>
<desc id="desc">48 consecutive original candles. No Elliott labels and no certified impulse. ${escape(bars[0].date)} through ${escape(bars.at(-1).date)}. MT5 server time, offset unknown.</desc>
<metadata id="source-data">${escape(JSON.stringify(identity))}</metadata>
<rect width="960" height="480" fill="#fffef9"/>
<g font-family="sans-serif" fill="#162f31">
<text x="30" y="32" font-size="18">XAUUSDm H4 / Real MT5 candles / No Elliott answer supplied</text>
<text x="30" y="57" font-size="13">Independent practice: mark swings first, then propose or reject a count.</text>
${[0, 1, 2, 3, 4].map((i) => {
    const price = max - span * i / 4;
    return `<line x1="80" x2="910" y1="${y(price)}" y2="${y(price)}" stroke="#d8dfd5"/><text x="73" y="${y(price) + 4}" text-anchor="end" font-size="12">${price.toFixed(3)}</text>`;
  }).join("")}
${bars.map((bar, i) => {
    const color = bar.close >= bar.open ? "#176455" : "#b54f24";
    return `<g><title>${escape(bar.date)} | O ${bar.open} H ${bar.high} L ${bar.low} C ${bar.close}</title><line x1="${x(i)}" x2="${x(i)}" y1="${y(bar.high)}" y2="${y(bar.low)}" stroke="${color}"/><rect x="${x(i) - 4}" y="${y(Math.max(bar.open, bar.close))}" width="8" height="${Math.max(1, Math.abs(y(bar.open) - y(bar.close)))}" fill="${color}"/></g>`;
  }).join("")}
${[0, 12, 24, 36, 47].map((i) => `<text x="${x(i)}" y="380" text-anchor="middle" font-size="12">#${i + 1}</text>`).join("")}
<text x="30" y="410" font-size="13">${escape(bars[0].date)} to ${escape(bars.at(-1).date)} / USD per ounce</text>
<text x="30" y="433" font-size="12">Source: ${escape(matches[0])}</text>
<text x="30" y="456" font-size="12">Server timezone, executable price basis and contract terms are not established. Structure study only.</text>
</g></svg>
`;
  const schematic = (points, titleEn, en, index) => diagramSvg(4, {
    points, labels: ["0", "1", "2", "3", "4", "5"], titleEn, en
  }, index);
  return {
    identity,
    files: {
      "impulse-supported.svg": schematic(supported, "Endpoint checks pass; subdivisions remain unverified", "Synthetic prices in USD per ounce. Motive lengths are 40, 70 and 60. Wave 4 ends above wave 1. Endpoint geometry alone does not certify an impulse.", 0),
      "impulse-overlap.svg": schematic(overlapping, "Rejected standard impulse: wave 4 overlaps wave 1", "Synthetic prices in USD per ounce. Wave 4 at 2335 lies inside wave-1 territory from 2300 to 2340. Reaching 2410 later does not repair the violation.", 1),
      "xauusd-h4-practice.svg": candleSvg
    }
  };
}

export function buildUnitSample() {
  const result = sampleFigures();
  const folder = resolve(root, "units/figures");
  mkdirSync(folder, { recursive: true });
  for (const [name, svg] of Object.entries(result.files)) writeFileSync(resolve(folder, name), svg);
  console.log(`Built 3 unit illustrations; real chart: ${result.identity.bars[0].date} to ${result.identity.bars.at(-1).date}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildUnitSample();
