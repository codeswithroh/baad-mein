// Parse a WhatsApp "Export chat" .txt (Android and iPhone formats) into messages.
// Works for the chat with yourself ("Message yourself"), where every line has the same sender.
// Dates are kept as "civil" times: a Date whose UTC fields are the wall-clock time in the
// chat, so nothing shifts when the phone and the chat disagree about time zones.

export interface Message {
  at: Date;
  sender: string;
  text: string;
}

export interface Chat {
  name: string;
  messages: Message[];
}

// Android: 17/10/2026, 9:41 pm - Priya: hi      (also 17/10/26, 21:41 - Priya: hi)
// iPhone:  [17/10/26, 9:41:05 PM] Priya: hi
const LINE =
  /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}?):\s([\s\S]*)$/i;

const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;

export function civil(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}

export function parseChat(raw: string, name = ''): Chat {
  const messages: Message[] = [];
  const lines = raw.replace(INVISIBLE, '').replace(/ | /g, ' ').split(/\r?\n/);
  // Most exports are day-first; switch to month-first only if a "day" is ever > 12 in slot two.
  const monthFirst = lines.some((l) => {
    const m = l.match(LINE);
    return m && Number(m[2]) > 12;
  });

  for (const line of lines) {
    const m = line.match(LINE);
    if (!m) {
      // A continuation of the previous message (multi-line text), or a system notice.
      if (messages.length && line.trim()) messages[messages.length - 1].text += '\n' + line;
      continue;
    }
    const [, a, b, yy, hh, mm, ampm, sender, text] = m;
    const day = Number(monthFirst ? b : a);
    const month = Number(monthFirst ? a : b);
    let year = Number(yy);
    if (year < 100) year += 2000;
    let hour = Number(hh);
    if (ampm) {
      const pm = /p/i.test(ampm);
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    const body = text.trim();
    if (/^<media omitted>$|^this message was deleted$|^you deleted this message$/i.test(body)) continue;
    messages.push({ at: civil(year, month, day, hour, Number(mm)), sender: sender.trim(), text: body });
  }

  return { name: name || guessName(messages), messages };
}

function guessName(messages: Message[]): string {
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Chat';
}

export function fmtTime(d: Date): string {
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Aug" (or "3 Aug 2025" when it isn't this year). */
export function fmtDay(d: Date, now?: Date): string {
  const base = `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  return now && now.getUTCFullYear() !== d.getUTCFullYear() ? `${base} ${d.getUTCFullYear()}` : base;
}
