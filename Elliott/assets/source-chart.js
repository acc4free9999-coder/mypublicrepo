(function (root) {
  "use strict";

  const coordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 1000;
  const validTarget = (target) => target && coordinate(target.x) && coordinate(target.y)
    && coordinate(target.rx) && coordinate(target.ry);

  // Acceptance is rectangular, including every boundary, even at chart edges.
  function isInRegion(x, y, target) {
    return Boolean(coordinate(x) && coordinate(y) && validTarget(target)
      && Math.abs(x - target.x) <= target.rx && Math.abs(y - target.y) <= target.ry);
  }

  root.SourceChart = { isInRegion };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SourceChart;
  if (typeof document === "undefined") return;

  const ns = "http://www.w3.org/2000/svg";
  function svgNode(name, attributes) {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function initialize() {
    document.querySelectorAll(".source-exercise").forEach((exercise) => {
      const svg = exercise.querySelector("svg.source-question-chart");
      const answer = exercise.querySelector("input.source-answer[data-question]");
      const feedback = exercise.querySelector(".source-chart-feedback");
      const xInput = exercise.querySelector(".source-x");
      const yInput = exercise.querySelector(".source-y");
      const configNode = exercise.querySelector("script.source-exercise-config");
      const check = exercise.querySelector("button.source-check");
      const clear = exercise.querySelector("button.source-clear");
      const place = exercise.querySelector("button.source-place");
      const report = (message) => {
        root.ElliottApp.error(`Source chart: ${message}`);
        if (feedback) {
          feedback.textContent = message;
          feedback.dataset.result = "error";
        }
      };
      if (!svg || !answer || !feedback || !xInput || !yInput || !configNode || !check || !clear || !place) {
        report("Incomplete exercise controls; this chart cannot accept answers.");
        return;
      }
      let config;
      try {
        config = JSON.parse(configNode.textContent);
      } catch (cause) {
        report(`Invalid exercise configuration JSON: ${cause.message}`);
        return;
      }
      if (!config || typeof config.id !== "string" || !config.id.trim()
        || typeof config.prompt !== "string" || typeof config.explanation !== "string"
        || !validTarget(config.target)) {
        report("Invalid exercise configuration; expected an id, prompt, explanation and target coordinates in 0–1000.");
        return;
      }

      svg.setAttribute("viewBox", "0 0 1000 1000");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${config.prompt} Use the labelled X and Y inputs to place a point without clicking.`);
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      for (const input of [xInput, yInput]) {
        input.type = "number";
        input.min = "0";
        input.max = "1000";
        input.step = "any";
      }
      for (const button of [check, clear, place]) button.type = "button";

      const overlay = svgNode("g", { class: "source-chart-overlay", "pointer-events": "none", "aria-hidden": "true" });
      const target = svgNode("rect", {
        class: "source-chart-target",
        x: config.target.x - config.target.rx,
        y: config.target.y - config.target.ry,
        width: config.target.rx * 2,
        height: config.target.ry * 2,
        "vector-effect": "non-scaling-stroke"
      });
      const marker = svgNode("g", { class: "source-chart-marker" });
      marker.append(
        svgNode("circle", { r: 13, "vector-effect": "non-scaling-stroke" }),
        svgNode("path", { d: "M -22 0 H 22 M 0 -22 V 22", "vector-effect": "non-scaling-stroke" })
      );
      overlay.append(target, marker);
      svg.append(overlay);
      let point = null;

      function stale() {
        target.setAttribute("display", "none");
        feedback.textContent = "";
        delete feedback.dataset.result;
      }
      function render() {
        marker.setAttribute("display", point ? "inline" : "none");
        if (point) marker.setAttribute("transform", `translate(${point.x} ${point.y})`);
      }
      function writeAnswer() {
        answer.value = point ? JSON.stringify({ exerciseId: config.id, x: point.x, y: point.y }) : "";
        // The workbook owns dirty tracking, explicit save/export, and beforeprint responses.
        answer.dispatchEvent(new Event("input", { bubbles: true }));
      }
      function setPoint(x, y) {
        point = { x, y };
        xInput.value = String(x);
        yInput.value = String(y);
        stale();
        render();
        writeAnswer();
        feedback.textContent = `Point placed at X ${x}, Y ${y}. Not checked; use Check to review.`;
      }
      function restore() {
        point = null;
        xInput.value = "";
        yInput.value = "";
        stale();
        render();
        if (answer.value === "") return;
        let saved;
        try {
          saved = JSON.parse(answer.value);
        } catch (cause) {
          report(`${config.id}: saved answer is invalid JSON (${cause.message}). Clear or place a new point before saving.`);
          return;
        }
        if (!saved || saved.exerciseId !== config.id || !coordinate(saved.x) || !coordinate(saved.y)) {
          report(`${config.id}: saved answer has a mismatched exercise or invalid coordinates. Clear or place a new point before saving.`);
          return;
        }
        point = { x: saved.x, y: saved.y };
        xInput.value = String(point.x);
        yInput.value = String(point.y);
        render();
        feedback.textContent = `Point restored at X ${point.x}, Y ${point.y}. Check to review.`;
      }

      svg.addEventListener("click", (event) => {
        const matrix = svg.getScreenCTM();
        if (!matrix || !matrix.a || !matrix.d) return;
        const position = svg.createSVGPoint();
        position.x = event.clientX;
        position.y = event.clientY;
        const { x, y } = position.matrixTransform(matrix.inverse());
        if (coordinate(x) && coordinate(y)) setPoint(x, y);
      });
      place.addEventListener("click", () => {
        const x = xInput.valueAsNumber;
        const y = yInput.valueAsNumber;
        if (!coordinate(x) || !coordinate(y)) {
          stale();
          feedback.dataset.result = "error";
          feedback.textContent = "Enter both X and Y as numbers from 0 to 1000, then place the point.";
          (!coordinate(x) ? xInput : yInput).focus();
          return;
        }
        setPoint(x, y);
      });
      for (const input of [xInput, yInput]) {
        input.addEventListener("input", stale);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            place.click();
          }
        });
      }
      check.addEventListener("click", () => {
        stale();
        if (!point) {
          feedback.dataset.result = "error";
          feedback.textContent = "Unanswered: click the chart or enter X and Y and place a point before checking.";
          return;
        }
        const passed = isInRegion(point.x, point.y, config.target);
        target.removeAttribute("display");
        feedback.dataset.result = passed ? "correct" : "revise";
        feedback.textContent = `${passed ? "Inside" : "Outside"} the intended chart region at X ${point.x}, Y ${point.y}. This checks location only, not a certified Elliott Wave interpretation. ${config.explanation}`;
      });
      clear.addEventListener("click", () => {
        point = null;
        xInput.value = "";
        yInput.value = "";
        stale();
        render();
        writeAnswer();
      });
      document.addEventListener("workbook-restored", restore);
      restore();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})(globalThis);
