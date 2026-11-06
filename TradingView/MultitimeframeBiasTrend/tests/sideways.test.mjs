import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../MultitimeframeBiasTrend.pine", import.meta.url), "utf8");
test("sideways phase inputs and drawing logic are removed", () => {
  assert.doesNotMatch(source, /\b(?:G_SIDE|sideEnabled|sideMethod|sideLength|sideConfirm|sideAdxMax|sideBbMax|sideRangeMax|sideEmaMax|sideChopMin|sideKeep|sideColor|sideQualifies|sideBoxes|sideBox)\b/);
});
