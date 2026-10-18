import { quizzes as foundations } from "./pdf-quiz-01-15.mjs";
import { quizzes as application } from "./pdf-quiz-16-30.mjs";
import { validateQuizzes } from "../scripts/pdf-unit-html.mjs";

export const quizzes = { ...foundations, ...application };
validateQuizzes(quizzes);
