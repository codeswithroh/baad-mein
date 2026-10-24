// Score the whole pipeline (code + Gemma) against the labelled chats.
// Also runs the "what if Gemma did the dates itself?" comparison that decided the design.

import { readChat, type Ask } from '../src/core/runner.ts';
import { DEV, HELDOUT, sorted, toMessages, type Row } from '../src/core/data.ts';
import { fmtDay } from '../src/core/whatsapp.ts';
import type { Note } from '../src/core/notes.ts';

const memory = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k), set: async (k: string, v: string) => void m.set(k, v), all: m };
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : '0/0');

export interface Score {
  set: string;
  notes: number;
  kindRight: number;
  kindByCode: number;
  gemmaNotes: number;
  gemmaKindRight: number;
  confusion: Record<string, Record<string, number>>;
  dates: { total: number; right: number; flagged: number; wrong: number; wrongList: string[] };
  money: { total: number; dirRight: number; flagged: number };
  secrets: { total: number; found: number };
  copied: { asked: number; exact: number; rewritten: number };
  doneLinked: number;
  ms: number;
  msPerBatch: number;
  replies: string[];
}

export async function score(name: string, rows: Row[], ask: Ask, log: (s: string) => void): Promise<Score> {
  const gold = sorted(rows);
  const msgs = toMessages(rows);
  const store = memory();
  const t0 = performance.now();
  let perBatch = 0;
  const notes: Note[] = await readChat(msgs, ask, store, (p) => {
    perBatch = p.msPerBatch ?? perBatch;
    log(`  ${name}: batch ${p.batch}/${p.batches}, ${p.done}/${p.total} notes`);
  });
  const ms = performance.now() - t0;

  const s: Score = {
    set: name,
    notes: notes.length,
    kindRight: 0,
    kindByCode: 0,
    gemmaNotes: 0,
    gemmaKindRight: 0,
    confusion: {},
    dates: { total: 0, right: 0, flagged: 0, wrong: 0, wrongList: [] },
    money: { total: 0, dirRight: 0, flagged: 0 },
    secrets: { total: 0, found: 0 },
    copied: { asked: 0, exact: 0, rewritten: 0 },
    doneLinked: notes.filter((n) => n.doneBy !== undefined).length,
    ms,
    msPerBatch: perBatch,
    replies: [...store.all.entries()].sort((a, b) => Number(a[0].split(':')[2]) - Number(b[0].split(':')[2])).map(([, v]) => v),
  };

  for (const n of notes) {
    const [at, text, kind, extra] = gold[n.i];
    const right = n.kind === kind;
    if (right) s.kindRight++;
    if (n.by === 'code' && right) s.kindByCode++;
    if (n.by === 'gemma') {
      s.gemmaNotes++;
      if (right) s.gemmaKindRight++;
      if (n.kind === 'todo' || n.kind === 'buy' || n.kind === 'money') {
        s.copied.asked++;
        if (n.what !== n.text || text.length < 60) s.copied.exact++;
        if (n.why.startsWith("Gemma's summary")) s.copied.rewritten++;
      }
    }
    (s.confusion[kind] ??= {})[n.kind] = (s.confusion[kind][n.kind] ?? 0) + 1;

    if (kind === 'secret') {
      s.secrets.total++;
      if (n.kind === 'secret') s.secrets.found++;
    }
    if (kind === 'todo' && extra) {
      s.dates.total++;
      const got = iso(n.when?.date);
      if (n.kind === 'todo' && n.when && !n.when.sure) s.dates.flagged++;
      else if (got === extra) s.dates.right++;
      else {
        s.dates.wrong++;
        s.dates.wrongList.push(`${at} "${text}" -> ${got ?? 'no date'} (want ${extra}, read as ${n.kind})`);
      }
    }
    if (kind === 'money') {
      s.money.total++;
      if (n.kind === 'money' && !n.sure) s.money.flagged++;
      else if (n.kind === 'money' && n.dir === extra) s.money.dirRight++;
    }
  }

  log(`\n== ${name}: ${s.notes} notes, ${(ms / 1000).toFixed(0)} s (${(perBatch / 1000).toFixed(1)} s per batch of 8)`);
  log(`kind right: ${pct(s.kindRight, s.notes)}   (Gemma's share: ${pct(s.gemmaKindRight, s.gemmaNotes)}; code settled ${pct(s.kindByCode, s.notes - s.gemmaNotes)})`);
  log(`due dates: right ${pct(s.dates.right, s.dates.total)}, flagged not-sure ${s.dates.flagged}, wrong ${s.dates.wrong}`);
  s.dates.wrongList.forEach((w) => log(`   wrong: ${w}`));
  log(`money: direction right ${pct(s.money.dirRight, s.money.total)}, flagged ${s.money.flagged}`);
  log(`secrets caught before Gemma: ${pct(s.secrets.found, s.secrets.total)}`);
  log(`Gemma rewrote instead of copying: ${s.copied.rewritten} of ${s.copied.asked}`);
  log(`to-dos closed by a later "done" note: ${s.doneLinked}`);
  log(`confusion (gold -> got): ${JSON.stringify(s.confusion)}`);
  return s;
}

/** The comparison: ask Gemma for the due date directly, with the sent date in the prompt. */
export async function gemmaDoesDates(ask: Ask, log: (s: string) => void) {
  const rows = sorted(HELDOUT).filter((r) => r[2] === 'todo' && r[3]);
  let right = 0;
  const wrong: string[] = [];
  for (let k = 0; k < rows.length; k += 8) {
    const batch = rows.slice(k, k + 8);
    const lines = batch
      .map(([at, text], j) => {
        const d = new Date(at.replace(' ', 'T') + ':00Z');
        return `[${j + 1}] written ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${fmtDay(d)} 2026: ${text}`;
      })
      .join('\n');
    const reply = await ask(`Each note below was written on the date shown. For each, give the date the task is due as YYYY-MM-DD.
"kal" means the next day, "parso" two days later, "aaj" the same day; a weekday means the next one.
Answer with ONLY a JSON array like [{"n":1,"due":"2026-10-25"}].
${lines}`);
    let arr: { n: number; due: string }[] = [];
    try {
      arr = JSON.parse(reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1));
    } catch {
      /* counts as wrong */
    }
    batch.forEach(([at, text, , want], j) => {
      const got = arr.find((a) => a.n === j + 1)?.due ?? arr[j]?.due;
      if (got === want) right++;
      else wrong.push(`${at} "${text}" -> ${got} (want ${want})`);
    });
  }
  log(`\n== Gemma does the dates itself: ${pct(right, rows.length)}`);
  wrong.forEach((w) => log(`   wrong: ${w}`));
  return { right, total: rows.length, wrong };
}

export async function runEval(ask: Ask, log: (s: string) => void, which: string[]) {
  const out: Record<string, unknown> = {};
  if (!which.length || which.includes('dev')) out.dev = await score('dev', DEV, ask, log);
  if (!which.length || which.includes('heldout')) out.heldout = await score('heldout', HELDOUT, ask, log);
  if (!which.length || which.includes('dates')) out.gemmaDates = await gemmaDoesDates(ask, log);
  return out;
}
