import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './style.css';
import { get, set } from 'idb-keyval';
import { unzipSync, strFromU8 } from 'fflate';
import { parseChat, fmtDay, type Message } from './core/whatsapp.ts';
import { readChat, replayStore, chatKey, type Progress } from './core/runner.ts';
import { buildDigest, asWhatsApp, type Digest } from './core/digest.ts';
import { SECRET_LABEL } from './core/sensitive.ts';
import type { Note } from './core/notes.ts';
import { HELDOUT, NOW, toMessages } from './core/data.ts';
import { loadGemma, generate, hasWebGpu } from './llm.ts';
import recorded from './recorded.json';

const $ = (id: string) => document.getElementById(id)!;
const screens = ['home', 'reading', 'card'];
const show = (id: string) => {
  screens.forEach((s) => $(s).classList.toggle('active', s === id));
  window.scrollTo(0, 0);
};

const DAY = 86_400_000;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let digest: Digest | null = null;
let notesById = new Map<number, Note>();
let stopper: AbortController | null = null;

// ---------- reading ----------

function onProgress(p: Progress) {
  const frac = p.total ? p.done / p.total : 0;
  $('sloth').style.left = `calc(${(frac * 100).toFixed(1)}% - ${frac * 28}px)`;
  const left = p.msPerBatch && p.batches > p.batch ? Math.ceil(((p.batches - p.batch) * p.msPerBatch) / 60000) : null;
  $('readCount').textContent =
    `Read ${p.done} of ${p.total} notes` +
    (left ? ` · about ${left} min to go` : '') +
    (p.resumed ? ` · ${p.resumed} batches picked up from last time` : '');
}

async function runLive(messages: Message[], label: string) {
  show('reading');
  $('readTitle').textContent = label;
  $('readCount').textContent = 'Waking Gemma up…';
  const lock = await (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): void }> } }).wakeLock
    ?.request('screen')
    .catch(() => null);
  stopper = new AbortController();
  try {
    await loadGemma((msg, f) => {
      $('readCount').textContent = msg;
      if (f !== undefined) $('sloth').style.left = `calc(${(f * 100).toFixed(1)}% - ${f * 28}px)`;
    });
    const notes = await readChat(messages, generate, { get, set: (k, v) => set(k, v) }, onProgress, stopper.signal);
    const now = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 7, 30));
    render(notes, now, 'Read live by Gemma 4 E2B in this tab. Nothing was uploaded.');
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      show('home');
      $('gpuNote').textContent = 'Stopped. Choose the same chat again to pick up where it left off.';
    } else {
      show('home');
      $('gpuNote').textContent = `Couldn't run Gemma here: ${(e as Error).message}`;
    }
  } finally {
    lock?.release();
  }
}

async function runExample() {
  // The example is a made-up chat. The answers are Gemma's real replies, saved from a run on a
  // laptop, replayed through exactly the same code a live run uses.
  const messages = toMessages(HELDOUT);
  const key = await chatKey(messages);
  const notes = await readChat(messages, async () => '', replayStore(recorded.replies, key), () => {});
  render(notes, NOW, `A made-up chat. Gemma's answers were recorded from ${recorded.model} on ${recorded.device}; your own chat runs live.`);
}

// ---------- the card ----------

function dueLabel(n: Note, now: Date): string {
  const d = n.when?.date;
  if (!d) return '';
  const days = Math.round((d.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY);
  const time = n.when?.time ? `, ${n.when.time}` : '';
  if (days === 0) return `today${time}`;
  if (days === 1) return `tomorrow${time}`;
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
  if (days <= 7) return `${WEEKDAY[d.getUTCDay()]}${time}`;
  return fmtDay(d) + time;
}

function line(n: Note, now: Date, extra = ''): string {
  const due = dueLabel(n, now);
  return `<li class="item" data-note="${n.i}">
    <span class="what">${esc(n.what)}</span>
    ${due ? `<span class="due ${due.includes('overdue') ? 'late' : ''}">${due}</span>` : ''}
    ${extra}
    <span class="src">from ${fmtDay(n.at, now)}</span>
  </li>`;
}

function section(cls: string, title: string, note: string, body: string, open = true): string {
  return `<details class="sec ${cls}" ${open ? 'open' : ''}><summary><h3>${title}</h3><span class="sec-note">${note}</span></summary>${body}</details>`;
}

function render(notes: Note[], now: Date, source: string) {
  digest = buildDigest(notes, now);
  notesById = new Map(notes.map((n) => [n.i, n]));
  const d = digest;
  $('cardDate').textContent = `${WEEKDAY[now.getUTCDay()]}, ${fmtDay(now)}`;
  $('cardTitle').textContent = `${d.counts.notes} notes. ${d.counts.needYou} need you.`;
  $('cardSub').textContent = d.counts.letGo
    ? `And ${d.counts.letGo} you can stop carrying around. Gemma read ${d.counts.byGemma}; plain code settled the other ${d.counts.byCode}.`
    : `Gemma read ${d.counts.byGemma}; plain code settled the other ${d.counts.byCode}.`;
  $('cardSource').textContent = source;

  const parts: string[] = [];
  if (d.today.length) parts.push(section('today', 'Today', 'due now, or overdue', `<ul>${d.today.map((n) => line(n, now)).join('')}</ul>`));
  if (d.week.length) parts.push(section('week', 'This week', 'dates worked out by code, not guessed', `<ul>${d.week.map((n) => line(n, now)).join('')}</ul>`));
  if (d.money.length) {
    const owed = d.money.filter((n) => n.dir === 'owes_me');
    const owe = d.money.filter((n) => n.dir === 'i_owe');
    const sum = (ns: Note[]) => ns.reduce((s, n) => s + (n.amount ?? 0), 0);
    const row = (n: Note) => line(n, now, `<span class="amt">${n.amount ? rupees(n.amount) : ''}</span>`);
    parts.push(
      section(
        'money',
        'Money',
        `owed to you ${rupees(sum(owed))} · you owe ${rupees(sum(owe))}`,
        (owed.length ? `<p class="sub">Owed to you</p><ul>${owed.map(row).join('')}</ul>` : '') +
          (owe.length ? `<p class="sub">You owe</p><ul>${owe.map(row).join('')}</ul>` : ''),
      ),
    );
  }
  if (d.buy.length) {
    parts.push(
      section('buy', 'To buy', `${d.buy.length} things, one list, from the last three weeks`, `<p class="chips">${d.buy.map((b) => `<span class="chip" data-note="${b.from[0].i}">${esc(b.item)}${b.from.length > 1 ? ` <small>×${b.from.length}</small>` : ''}</span>`).join('')}</p>`),
    );
  }
  if (d.someday.length) parts.push(section('someday', 'No date yet', 'written this month', `<ul>${d.someday.map((n) => line(n, now)).join('')}</ul>`, false));
  if (d.unsure.length) {
    parts.push(
      section(
        'unsure',
        'Not sure',
        'Baad Mein would rather ask than guess',
        `<ul>${d.unsure.map((n) => line(n, now, `<span class="why">${esc(n.why)}</span>`)).join('')}</ul>`,
      ),
    );
  }
  if (d.secrets.length) {
    parts.push(
      section(
        'secrets',
        'Delete these from the chat',
        'found by code, never shown to Gemma',
        `<ul>${d.secrets.map((n) => `<li class="item" data-note="${n.i}"><span class="what">${n.secrets.map((s) => `${SECRET_LABEL[s.kind]} <code>${esc(s.masked)}</code>`).join(', ')}</span><span class="src">from ${fmtDay(n.at, now)}</span></li>`).join('')}</ul>`,
      ),
    );
  }
  if (d.read.length) parts.push(section('read', 'Read or watch later', `${d.read.length} from the last two months`, `<ul>${d.read.slice(0, 8).map((n) => readLine(n, now)).join('')}</ul>${d.read.length > 8 ? `<p class="fine">and ${d.read.length - 8} more</p>` : ''}`, false));
  if (d.keep.length) parts.push(section('keep', 'Worth keeping', 'addresses, numbers, ideas', `<ul>${d.keep.map((n) => line(n, now)).join('')}</ul>`, false));
  if (d.letGo.length) {
    parts.push(
      section(
        'letgo',
        `Let go of ${d.counts.letGo}`,
        'permission granted',
        d.letGo.map((g) => `<p class="sub">${g.notes.length} · ${esc(g.why)}</p><ul class="faded">${g.notes.map((n) => (n.kind === 'read' ? readLine(n, now) : line(n, now))).join('')}</ul>`).join(''),
        false,
      ),
    );
  }
  if (d.done.length) parts.push(section('done', 'Already done', 'a later note said so', `<ul class="faded">${d.done.map((n) => line(n, now, `<span class="why">closed by “${esc(notesById.get(n.doneBy!)?.text ?? '')}”</span>`)).join('')}</ul>`, false));

  $('sections').innerHTML = parts.join('');
  show('card');
}

function readLine(n: Note, now: Date): string {
  const link = n.links[0];
  const label = n.links.length && n.what && n.what !== n.text && !/^[A-Z][a-z]+(, [A-Z][a-z]+)*$/.test(n.what) ? n.what : n.text.replace(/https?:\/\/\S+/g, '').trim() || link?.url;
  return `<li class="item" data-note="${n.i}">
    <span class="what">${link ? `<span class="site">${link.site}</span> ` : ''}${esc(label ?? '')}</span>
    ${link ? `<a class="open" href="${esc(link.url)}" target="_blank" rel="noopener">open</a>` : ''}
    <span class="src">from ${fmtDay(n.at, now)}</span>
  </li>`;
}

// Tap any line to see the note it came from, word for word.
$('sections').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-note]') as HTMLElement | null;
  if (!el || (e.target as HTMLElement).closest('a')) return;
  const open = el.querySelector('.orig');
  if (open) return open.remove();
  const n = notesById.get(Number(el.dataset.note));
  if (!n) return;
  const div = document.createElement('div');
  div.className = 'orig';
  div.textContent = n.kind === 'secret' ? 'Hidden here too. Delete it from WhatsApp.' : `“${n.text}”`;
  el.append(div);
});

// ---------- buttons ----------

$('example').addEventListener('click', () => runExample());

$('file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  let text: string;
  if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const txt = Object.entries(files).find(([name]) => /\.txt$/i.test(name));
    if (!txt) return void ($('gpuNote').textContent = 'That zip has no chat .txt inside.');
    text = strFromU8(txt[1]);
  } else {
    text = await file.text();
  }
  const chat = parseChat(text);
  if (!chat.messages.length) return void ($('gpuNote').textContent = "That file doesn't look like a WhatsApp export.");
  if (!(await hasWebGpu())) {
    $('gpuNote').textContent = 'This browser has no WebGPU, so Gemma cannot run here. Try Chrome or Edge on a laptop, or see the example.';
    return;
  }
  runLive(chat.messages, `Reading ${chat.messages.length} notes`);
});

$('stop').addEventListener('click', () => stopper?.abort());
$('again').addEventListener('click', () => show('home'));
$('copy').addEventListener('click', async () => {
  if (!digest) return;
  const now = digest.now;
  await navigator.clipboard.writeText(asWhatsApp(digest, (n) => n.what + (n.when?.date ? ` (${dueLabel(n, now)})` : '') + (n.amount ? ` ${rupees(n.amount)}` : '')));
  $('copy').textContent = 'Copied. Paste it in your chat with yourself.';
  setTimeout(() => ($('copy').textContent = 'Copy as a WhatsApp message'), 2500);
});

hasWebGpu().then((ok) => {
  if (!ok) $('gpuNote').textContent = 'This browser has no WebGPU, so your own chat needs Chrome or Edge on a laptop. The example works anywhere.';
});
