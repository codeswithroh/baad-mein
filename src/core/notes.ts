// From "a chat with yourself" to sorted notes.
//
// The split of work, and the one rule:
//   code   finds secrets, links and empty notes before Gemma sees anything
//   Gemma  says what kind of note each one is, and COPIES the words that matter
//   code   checks every copied word is really in the note, works out every date and amount,
//          and marks a note "not sure" instead of guessing when something doesn't add up.

import { findSecrets, type Secret } from './sensitive.ts';
import { findLinks, onlyLinks, parseAmount, moneyDirection, splitItems, type Link, type Direction } from './fields.ts';
import { resolveWhen, romanise, type When } from './when.ts';
import type { Message } from './whatsapp.ts';

export type Kind = 'todo' | 'buy' | 'money' | 'read' | 'keep' | 'done' | 'noise';
export const KINDS: Kind[] = ['todo', 'buy', 'money', 'read', 'keep', 'done', 'noise'];

/** What Gemma returns for one note. Everything here is checked before it is used. */
export interface Guess {
  n: number;
  kind: string;
  what?: string;
  when?: string;
  who?: string;
}

export interface Note {
  i: number; // position in the chat
  at: Date;
  text: string;
  kind: Kind | 'secret';
  by: 'code' | 'gemma';
  what: string; // the words that matter, copied from the note
  when: When | null;
  links: Link[];
  secrets: Secret[];
  items: string[]; // for "buy"
  amount: number | null; // for "money"
  dir: Direction | null;
  who: string | null;
  sure: boolean;
  why: string; // shown when not sure
  doneBy?: number; // index of a later note that says this was done
}

const NOISE = /^(test|testing|hi|hello|ok|okay|k|hmm+|\.+|-+|\?+|yo|a|aa)$/i;

/** Normalise for "is this really in the note?" checks: case, spaces, quotes, Devanagari kal/aaj. */
export function norm(s: string): string {
  return romanise(s)
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** The copied words appear in the note, word for word (or, at worst, every word appears). */
export function copiedFrom(quote: string, text: string): 'exact' | 'words' | 'no' {
  const q = norm(quote);
  const t = norm(text);
  if (!q) return 'no';
  if (t.includes(q)) return 'exact';
  const words = q.split(' ').filter((w) => w.length > 1);
  return words.length && words.every((w) => t.includes(w)) ? 'words' : 'no';
}

// Day words code can find on its own, so a date in the note is never missed because Gemma left `when` empty.
const DAY_WORDS =
  /\b(aaj|aj|today|tonight|kal|kl|tomorrow|tmrw|tmr|parso|parson|narso|day after tomorrow|(next|agle|agla)\s+\w+|sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?|ravivar|somvar|shanivar|\d{1,2}\s*(st|nd|rd|th|tarikh|tareekh)|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}|\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?)\b(\s*(subah|shaam|sham|raat|morning|evening|night)?\s*\d{0,2}\s*(baje|bje|am|pm)?)?/i;

function base(m: Message, i: number): Note {
  return {
    i,
    at: m.at,
    text: m.text,
    kind: 'noise',
    by: 'code',
    what: m.text,
    when: null,
    links: findLinks(m.text),
    secrets: [],
    items: [],
    amount: null,
    dir: null,
    who: null,
    sure: true,
    why: '',
  };
}

/**
 * Step 1, code only. Returns the notes code has already settled, and the ones Gemma needs to read.
 * Secrets never reach Gemma.
 */
export function precheck(messages: Message[]): { settled: Note[]; forGemma: Note[] } {
  const settled: Note[] = [];
  const forGemma: Note[] = [];
  messages.forEach((m, i) => {
    const n = base(m, i);
    const secrets = findSecrets(m.text);
    if (secrets.length) {
      settled.push({ ...n, kind: 'secret', secrets, what: '' });
    } else if (onlyLinks(m.text)) {
      settled.push({ ...n, kind: 'read', what: n.links.map((l) => l.site).join(', ') });
    } else if (NOISE.test(m.text.trim()) || m.text.replace(/[\s\p{Extended_Pictographic}\p{P}]/gu, '').length < 2) {
      settled.push({ ...n, kind: 'noise' });
    } else {
      forGemma.push(n);
    }
  });
  return { settled, forGemma };
}

/** Step 2: apply one of Gemma's guesses to a note, checking everything it says. */
export function applyGuess(note: Note, g: Guess | undefined): Note {
  const n: Note = { ...note, by: 'gemma' };
  if (!g || !KINDS.includes(g.kind as Kind)) {
    return { ...n, kind: 'keep', sure: false, why: "Gemma didn't say what this is, so it's kept as a note." };
  }
  n.kind = g.kind as Kind;

  // "what": must be copied from the note. If Gemma rewrote it, use the note itself and say so.
  const copied = g.what ? copiedFrom(g.what, n.text) : 'no';
  if (copied === 'no') {
    n.what = n.text;
    if (n.kind === 'todo' || n.kind === 'buy' || n.kind === 'money') {
      n.sure = false;
      n.why = "Gemma's summary used words that aren't in your note, so here's the note as you wrote it.";
    }
  } else {
    n.what = g.what!.trim();
  }

  // "when": code reads the date. Gemma's words if they're in the note, otherwise whatever day words code finds.
  const whenQuote = g.when && copiedFrom(g.when, n.text) !== 'no' ? g.when : (n.text.match(DAY_WORDS)?.[0] ?? '');
  // Only to-dos get a due date. "Ankit ko 1200 dena hai dinner ka" is about money, not about when.
  if (whenQuote.trim() && n.kind === 'todo') {
    n.when = resolveWhen(whenQuote, n.text, n.at);
    if (!n.when.sure) {
      n.sure = false;
      n.why = n.when.why;
    }
  }

  if (n.kind === 'buy') {
    n.items = splitItems(n.what);
    if (!n.items.length) n.items = [n.what];
  }

  if (n.kind === 'money') {
    n.amount = parseAmount(n.what) ?? parseAmount(n.text);
    n.dir = moneyDirection(n.text);
    n.who = g.who && copiedFrom(g.who, n.text) !== 'no' ? g.who.trim() : null;
    if (!n.dir) {
      n.sure = false;
      n.why = "The note doesn't say who pays whom.";
    } else if (!n.amount) {
      n.sure = false;
      n.why = "Couldn't find an amount in the note.";
    }
  }
  return n;
}

const STOP = new Set(
  'the and for with from that this have done paid pay ka ki ke ko hai ho gaya gayi diya dilam kora hoyeche karna kar dena lena aaj kal call bill'.split(' '),
);
const content = (s: string) => new Set(norm(s).split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w)));

// "renew" and "renewed" match on their first five letters. A long specific word ("electricity",
// "insurance") counts twice: on its own it is usually enough to say which task was done.
const same = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
function overlap(a: string[], b: string[]): number {
  return a.filter((w) => b.some((x) => same(w, x))).reduce((s, w) => s + (w.length >= 8 ? 2 : 1), 0);
}

/** Step 3: "paid electricity bill" on the 9th closes "pay electricity bill by 12th" from the 2nd. */
export function linkDone(notes: Note[]): Note[] {
  const out = notes.map((n) => ({ ...n }));
  const dones = out.filter((n) => n.kind === 'done');
  for (const t of out) {
    if (t.kind !== 'todo' && t.kind !== 'money') continue;
    const words = [...content(t.what)];
    const need = words.length > 1 ? 2 : 1;
    const closer = dones.find((d) => d.at > t.at && overlap(words, [...content(d.text)]) >= need);
    if (closer) t.doneBy = closer.i;
  }
  return out;
}

/** Everything in chat order. */
export function combine(settled: Note[], read: Note[]): Note[] {
  return linkDone([...settled, ...read].sort((a, b) => a.i - b.i));
}
