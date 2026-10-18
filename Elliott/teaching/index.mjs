import { units as foundations } from "./units-01-10.mjs";
import { units as patterns } from "./units-11-20.mjs";
import { units as practice } from "./units-21-30.mjs";

export const teachingUnits = [...foundations, ...patterns, ...practice];
export const teachingByDay = Object.fromEntries(teachingUnits.map((unit) => [unit.day, unit]));

export function validateTeaching() {
  if (teachingUnits.length !== 30 || new Set(teachingUnits.map((unit) => unit.day)).size !== 30) throw new Error("Expected thirty unique bilingual teaching units.");
  for (const unit of teachingUnits) {
    if (!Number.isInteger(unit.day) || unit.day < 1 || unit.day > 30 || !unit.titleVi) throw new Error("Invalid teaching unit identity.");
    if (unit.principles.length < 4 || unit.figures.length < 2 || unit.questions.length < 6) throw new Error(`Day ${unit.day}: insufficient principles, images, or questions.`);
    for (const principle of unit.principles) {
      if (!principle.titleVi || !principle.titleEn || principle.vi.length < 180 || principle.en.length < 180) throw new Error(`Day ${unit.day}: principle needs substantive bilingual explanation.`);
    }
    for (const figure of unit.figures) {
      if (figure.kind !== "path" || !Array.isArray(figure.points) || figure.points.length < 3 || figure.points.length > 9 || figure.points.length !== figure.labels.length || !figure.points.every(Number.isFinite) || new Set(figure.points).size < 2) throw new Error(`Day ${unit.day}: invalid illustrated example.`);
      for (const field of ["titleVi", "titleEn", "vi", "en"]) if (typeof figure[field] !== "string" || !figure[field].trim()) throw new Error(`Day ${unit.day}: missing diagram explanation ${field}`);
    }
    for (const question of unit.questions) {
      for (const field of ["vi", "en", "answerVi", "answerEn"]) if (typeof question[field] !== "string" || question[field].length < 20) throw new Error(`Day ${unit.day}: incomplete bilingual question/answer ${field}`);
    }
    for (const field of ["walkthrough", "mistakes"]) {
      if (!unit[field]?.vi || !unit[field]?.en) throw new Error(`Day ${unit.day}: missing bilingual ${field}`);
      for (const language of ["vi", "en"]) {
        if (unit[field][language].trim().split(/\s+/).length < (field === "walkthrough" ? 65 : 25)) throw new Error(`Day ${unit.day}: ${language} ${field} is too brief.`);
      }
    }
  }
}
