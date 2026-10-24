// The morning card. All of this is plain code over the checked notes: what's due, what to
// buy, who owes what, what to read, and the part a sloth would write: what you can let go.

import type { Note } from './notes.ts';
import { itemKey } from './fields.ts';

const DAY = 86_400_000;

export interface Digest {
  now: Date;
  today: Note[]; // due today, or overdue by up to two weeks
  week: Note[]; // due in the next 7 days
  someday: Note[]; // no date, written in the last 30 days
  buy: { item: string; from: Note[] }[];
  money: Note[];
  read: Note[];
  keep: Note[];
  secrets: Note[];
  unsure: Note[];
  letGo: { why: string; notes: Note[] }[];
  done: Note[]; // todos a later note says were done
  counts: { notes: number; byCode: number; byGemma: number; needYou: number; letGo: number };
}

const day = (d: Date) => Math.floor(d.getTime() / DAY);

export function buildDigest(notes: Note[], now: Date): Digest {
  const today = day(now);
  const ageDays = (n: Note) => today - day(n.at);
  const live = notes.filter((n) => n.doneBy === undefined);

  const unsure = live.filter((n) => !n.sure && n.kind !== 'secret');
  const sure = live.filter((n) => n.sure);

  const dated = sure.filter((n) => n.kind === 'todo' && n.when?.date);
  const due = (n: Note) => day(n.when!.date!);
  const todayList = dated.filter((n) => due(n) <= today && due(n) >= today - 14).sort((a, b) => due(a) - due(b));
  const week = dated.filter((n) => due(n) > today && due(n) <= today + 7).sort((a, b) => due(a) - due(b));
  const staleDated = dated.filter((n) => due(n) < today - 14);

  const undated = sure.filter((n) => n.kind === 'todo' && !n.when?.date);
  const someday = undated.filter((n) => ageDays(n) <= 30);
  const staleUndated = undated.filter((n) => ageDays(n) > 30);

  // Shopping: one list, merged, from the last three weeks. Older lists have been bought or forgotten.
  const buyNotes = sure.filter((n) => n.kind === 'buy');
  const freshBuy = buyNotes.filter((n) => ageDays(n) <= 21);
  const staleBuy = buyNotes.filter((n) => ageDays(n) > 21);
  const merged = new Map<string, { item: string; from: Note[] }>();
  for (const n of freshBuy) {
    for (const item of n.items) {
      const k = itemKey(item) || item.toLowerCase();
      const hit = merged.get(k);
      if (hit) hit.from.push(n);
      else merged.set(k, { item, from: [n] });
    }
  }

  const read = sure.filter((n) => n.kind === 'read');
  const freshRead = read.filter((n) => ageDays(n) <= 60);
  const staleRead = read.filter((n) => ageDays(n) > 60);

  const letGo = [
    { why: 'Links older than two months. If they mattered, you would have opened one by now.', notes: staleRead },
    { why: 'Tasks whose date passed more than two weeks ago. Done, or it didn’t matter.', notes: staleDated },
    { why: 'Undated to-dos over a month old. Still important? Write them again.', notes: staleUndated },
    { why: 'Shopping lists older than three weeks.', notes: staleBuy },
  ].filter((g) => g.notes.length);

  const letGoCount = letGo.reduce((s, g) => s + g.notes.length, 0);
  const money = sure.filter((n) => n.kind === 'money');

  return {
    now,
    today: todayList,
    week,
    someday,
    buy: [...merged.values()],
    money,
    read: freshRead.sort((a, b) => b.at.getTime() - a.at.getTime()),
    keep: sure.filter((n) => n.kind === 'keep'),
    secrets: notes.filter((n) => n.kind === 'secret'),
    unsure,
    letGo,
    done: notes.filter((n) => n.doneBy !== undefined),
    counts: {
      notes: notes.length,
      byCode: notes.filter((n) => n.by === 'code').length,
      byGemma: notes.filter((n) => n.by === 'gemma').length,
      needYou: todayList.length + week.length + money.length + unsure.length,
      letGo: letGoCount,
    },
  };
}

/** The digest as one WhatsApp message, to send back to yourself. */
export function asWhatsApp(d: Digest, fmt: (n: Note) => string): string {
  const lines: string[] = ['*Baad Mein, this morning*'];
  const section = (title: string, notes: Note[]) => {
    if (!notes.length) return;
    lines.push('', `*${title}*`, ...notes.map((n) => `• ${fmt(n)}`));
  };
  section('Today', d.today);
  section('This week', d.week);
  if (d.buy.length) lines.push('', '*To buy*', d.buy.map((b) => b.item).join(', '));
  section('Money', d.money);
  if (d.counts.letGo) lines.push('', `_Let go of ${d.counts.letGo} old notes. They can wait forever._`);
  if (d.secrets.length) lines.push('', `⚠️ ${d.secrets.length} notes have an OTP, card number or password in them. Delete those from the chat.`);
  return lines.join('\n');
}
