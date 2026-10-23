import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const main = read("MultitimeframeBiasTrend.pine");

test("one indicator shows a full RSI pane with chart-overlay price signals", () => {
  assert.match(main, /indicator\([^\n]+overlay = false/);
  const module = main.slice(main.indexOf("// RSI is applied"), main.indexOf("alertcondition(alertFlip"));
  assert.doesNotMatch(module, /alertcondition\(/);
  for (const surface of ["RSI of momentum", "RSI midline", "RSI upper band", "RSI lower band",
    "RSI bearish gradient", "RSI bullish gradient", "Bullish RSI divergence", "Bearish RSI divergence"]) {
    assert.ok(main.includes(`"${surface}"`), surface);
  }
  assert.match(main, /rdOscLines\.push\(line\.new\([^\n]+width = 2\)\)/);
  assert.match(main, /while rdOscLines\.size\(\) > rdKeep \* 2/);
  assert.match(main, /rdPriceLines\.push\(line\.new\([^\n]+force_overlay = true/);
});

test("main indicator retains confirmed momentum-RSI divergence conditions", () => {
  for (const source of [main]) {
    assert.match(source, /ta\.rsi\(ta\.mom\(close, 10\), (?:rsiLen|rdLength)\)/);
    assert.match(source, /ta\.pivotlow\(rdRsi, 5, 5\)/);
    assert.match(source, /ta\.pivothigh\(rdRsi, 5, 5\)/);
    assert.match(source, /ta\.barssince\(rdLow\[1\]\)/);
    assert.match(source, /ta\.barssince\(rdHigh\[1\]\)/);
    assert.match(source, /bar_index - 5/);
    assert.match(source, /if rdEnabled and rdShowZones and barstate\.isconfirmed/);
  }
  for (const name of ["rdBull", "rdBear"]) {
    const condition = source => source.match(new RegExp(`^bool ${name} = (.*)$`, "m"))[1];
    assert.ok(condition(main).includes("barstate.isconfirmed"));
  }
});

test("RSI styling matches the green-purple reference independently of shared zone colors", () => {
  assert.match(main, /color rdBullColor = #33c570/);
  assert.match(main, /color rdBearColor = #ae4ce6/);
  assert.match(main, /color\.from_gradient\(rdRsi, 30, 70, rdBullColor, rdBearColor\), linewidth = 1/);
  assert.match(main, /fill\(rdRsiPlot, rdMidPlot, 70, 30, rdBearColor, na/);
  assert.match(main, /fill\(rdRsiPlot, rdMidPlot, 70, 30, na, rdBullColor/);
  const module = main.slice(main.indexOf("// RSI is applied"), main.indexOf("alertcondition(alertFlip"));
  assert.doesNotMatch(module, /\bcBull\b|\bcBear\b/);
});

test("zone cleanup retains stopped zones in bounded ownership and guards empty arrays", () => {
  for (const source of [main]) {
    assert.match(source, /while zones\.size\(\) > rdKeep/);
    assert.match(source, /expired\.primary\.delete\(\)/);
    assert.match(source, /expired\.glow\.delete\(\)/);
    assert.match(source, /if zones\.size\(\) > 0\s+for i = zones\.size\(\) - 1 to 0/);
    assert.match(source, /zone\.active := false/);
    assert.match(source, /zone\.primary\.set_style\(line\.style_dashed\)/);
    assert.doesNotMatch(source, /zones\.remove\(/);
  }
});

// Inspect whole calls, including multiline and nested constructor arguments.
function calls(source, name) {
  const result = [];
  const pattern = new RegExp(`\\b${name.replaceAll(".", "\\.")}\\s*\\(`, "g");
  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let quote = null;
    let end = match.index + match[0].length;
    while (depth > 0 && end < source.length) {
      const char = source[end++];
      if (quote) {
        if (char === quote && source[end - 2] !== "\\") quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")") depth--;
    }
    assert.equal(depth, 0, `balanced ${name} call`);
    result.push(source.slice(match.index, end));
  }
  return result;
}

test("every existing price visual and dashboard remains on the main chart", () => {
  for (const name of ["label.new", "box.new", "table.new", "bgcolor"]) {
    const found = calls(main, name);
    assert.ok(found.length > 0, name);
    for (const call of found) assert.match(call, /force_overlay = true/, call);
  }
  const oscillatorLine = "line.new(bullish ? rdPrevLowBar : rdPrevHighBar, bullish ? rdPrevLowRsi : rdPrevHighRsi, bar_index - 5, rdRsi[5], color = shade, width = 2)";
  const paneLines = calls(main, "line.new").filter(call => !call.includes("force_overlay = true"));
  assert.deepEqual(paneLines, [oscillatorLine]);
  const panePlots = calls(main, "plot").filter(call => !call.includes("force_overlay = true"));
  assert.equal(panePlots.length, 2);
  assert.ok(panePlots[0].includes('"RSI of momentum"'));
  assert.ok(panePlots[1].includes('"RSI midline"'));
  for (const call of calls(main, "plotshape")) assert.doesNotMatch(call, /force_overlay/);
});
