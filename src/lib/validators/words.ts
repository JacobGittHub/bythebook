// The word list that names, titles, descriptions and reviews are checked against
// (plans/bookstore.md D25). `obscenity` folds the text first (case, accents, look-alike letters,
// spellings like "sh1t", repeated letters) and keeps allowed words such as "Scunthorpe" passing.
// It is pure, so the browser and the server check alike, and the text goes nowhere.

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

/** What a refused text is told. It doesn't repeat the word. */
export const BANNED_WORDS_MESSAGE = "That has a word we don't allow. Try other wording.";

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

// Three or more single letters or digits, each followed by one separator: "f u c k", "s.h.i.t",
// "s_h_i_t".
const SPACED_LETTERS = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][\s._*-]){2,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu;

/** The text with spaced-out letters joined, which `obscenity` reads as separate words. */
export function joinSpacedLetters(text: string): string {
  return text.replace(SPACED_LETTERS, (run) => run.replace(/[\s._*-]/g, ""));
}

/** True when the text holds a word the list refuses, spaced out or not. */
export function hasBannedWords(text: string): boolean {
  return matcher.hasMatch(text) || matcher.hasMatch(joinSpacedLetters(text));
}
