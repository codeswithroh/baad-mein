// What Gemma is asked, and how its answer is read back.
// Small batches on purpose: a 2B model keeps eight notes straight far better than forty.

import type { Note, Guess } from './notes.ts';

export const BATCH = 8;

const EXAMPLES = `Example notes:
[1] call bank re: credit card annual fee kal
[2] dahi, bread aur 2 maggi
[3] Raju ko 500 dena hai
[4] Pune flat: 4B, Palm Grove Society, Baner Road
[5] paid electricity bill
[6] https://youtu.be/abc must watch this weekend
[7] Didi theke 2000 nite hobe

Example answer:
[{"n":1,"kind":"todo","what":"call bank re: credit card annual fee","when":"kal","who":""},
{"n":2,"kind":"buy","what":"dahi, bread aur 2 maggi","when":"","who":""},
{"n":3,"kind":"money","what":"Raju ko 500 dena","when":"","who":"Raju"},
{"n":4,"kind":"keep","what":"Pune flat: 4B, Palm Grove Society, Baner Road","when":"","who":""},
{"n":5,"kind":"done","what":"paid electricity bill","when":"","who":""},
{"n":6,"kind":"read","what":"must watch","when":"this weekend","who":""},
{"n":7,"kind":"money","what":"Didi theke 2000 nite hobe","when":"","who":"Didi"}]`;

export function promptFor(batch: Note[]): string {
  const notes = batch.map((n, k) => `[${k + 1}] ${n.text.replace(/\n+/g, ' / ')}`).join('\n');
  return `These are notes a person sent to themselves on WhatsApp, to deal with later. They mix English, Hindi and Bengali written in Roman letters.

For each note, pick ONE kind:
- todo: something they have to do (call, pay a bill, renew, book, submit, fix, go somewhere, remind someone)
- buy: things to buy (also "lena hai", "le aana", "kinte hobe", "kinbo", medicine to get)
- money: someone owes them money, or they owe someone
- read: an article, video, book, film, show or link to read or watch later
- keep: information worth keeping (address, phone number, clothes or shoe size, recipe, idea, quote, place). A size is keep, not buy.
- done: a record that something is already finished ("paid rent", "gym done", "ho gaya")
- noise: tests, half-typed words, jokes, nothing useful

Then COPY words from the note. Never rewrite, never translate, never work out a date.
- what: the shortest exact words from the note that say the task, the items, or the information
- when: the exact words that say when ("kal", "friday", "12th", "this weekend"), or ""
- who: for money, the person's name exactly as written, or ""

${EXAMPLES}

Now these notes. Answer with ONLY a JSON array, one object per note, in order:
${notes}`;
}

/** Pull the array out of Gemma's reply and map it back to the batch. Missing entries stay undefined. */
export function readGuesses(reply: string, size: number): (Guess | undefined)[] {
  const start = reply.indexOf('[');
  const out: (Guess | undefined)[] = new Array(size).fill(undefined);
  if (start < 0) return out;
  // A reply cut off mid-array has no closing bracket: keep whatever came before the cut.
  const close = reply.lastIndexOf(']');
  const body = (close > start ? reply.slice(start, close + 1) : reply.slice(start))
    // Gemma 4 E2B now and then writes "who="" " for "who":"". Put the colon back.
    .replace(/"(\w+)="(""|"[^"]*")/g, (_, k, v) => `"${k}":${v === '""' ? '""' : v}`)
    .replace(/"(\w+)=""/g, '"$1":""');
  let arr: unknown;
  try {
    arr = JSON.parse(body);
  } catch {
    // One broken object shouldn't lose the whole batch: read the objects one by one.
    arr = [...body.matchAll(/\{[^{}]*\}/g)].map((m) => {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    });
  }
  if (!Array.isArray(arr)) return out;
  arr.forEach((g, k) => {
    if (!g || typeof g !== 'object') return;
    const guess = g as Guess;
    const idx = Number.isInteger(guess.n) && guess.n >= 1 && guess.n <= size ? guess.n - 1 : k;
    if (idx < size && !out[idx]) out[idx] = guess;
  });
  return out;
}
