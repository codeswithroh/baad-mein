import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets, luhn, verhoeff } from '../src/core/sensitive.ts';
import { parseAmount, moneyDirection, splitItems, onlyLinks, findLinks } from '../src/core/fields.ts';
import { precheck, applyGuess, combine, copiedFrom } from '../src/core/notes.ts';
import { buildDigest } from '../src/core/digest.ts';
import { readGuesses } from '../src/core/prompt.ts';
import { parseChat } from '../src/core/whatsapp.ts';
import { DEV, HELDOUT, NOW, toExport, toMessages, sorted } from '../src/core/data.ts';

const ALL = [...DEV, ...HELDOUT];

test('checksums', () => {
  assert.equal(luhn('4111111111111111'), true);
  assert.equal(luhn('4111111111111112'), false);
  assert.equal(verhoeff('234567890124'), true);
  assert.equal(verhoeff('234567890125'), false);
});

test('every labelled secret is found, and nothing else is', () => {
  for (const [, text, kind, extra] of ALL) {
    const s = findSecrets(text);
    if (kind === 'secret') {
      assert.ok(s.length, `missed: ${text}`);
      assert.ok(s.some((x) => x.kind === extra), `wrong kind for: ${text} -> ${s.map((x) => x.kind)}`);
    } else {
      assert.equal(s.length, 0, `false alarm: ${text} -> ${JSON.stringify(s)}`);
    }
  }
});

test('money direction from the words alone matches every label', () => {
  for (const [, text, kind, extra] of ALL) {
    if (kind !== 'money') continue;
    assert.equal(moneyDirection(text), extra, text);
    assert.ok(parseAmount(text), `no amount: ${text}`);
  }
});

test('amounts', () => {
  assert.equal(parseAmount('Kunal owes me 2k for Goa stay'), 2000);
  assert.equal(parseAmount('Ankit ko 1,200 dena hai'), 1200);
  assert.equal(parseAmount('₹450 cab'), 450);
});

test('shopping lists split into items', () => {
  assert.deepEqual(splitItems('dahi, bread aur 2 maggi'), ['dahi', 'bread', '2 maggi']);
  assert.deepEqual(splitItems('buy: atta 5kg, toor dal, Surf excel'), ['atta 5kg', 'toor dal', 'Surf excel']);
  assert.deepEqual(splitItems('Dhaniya, adrak, nimbu lena'), ['Dhaniya', 'adrak', 'nimbu']);
});

test('links', () => {
  assert.equal(onlyLinks('https://youtu.be/Jx8fdC1oQ7c'), true);
  assert.equal(onlyLinks('https://maps.app.goo.gl/x8KqT2 new biryani place'), false);
  assert.equal(findLinks('https://www.instagram.com/reel/C9xYz')[0].site, 'Instagram');
});

test('copied words are checked, not trusted', () => {
  assert.equal(copiedFrom('call bank', 'call bank re: card'), 'exact');
  assert.equal(copiedFrom('phone the bank', 'call bank re: card'), 'no');
});

test('the export round-trips through the WhatsApp parser', () => {
  const chat = parseChat(toExport(HELDOUT));
  assert.equal(chat.messages.length, HELDOUT.length);
  assert.equal(chat.messages[0].text, sorted(HELDOUT)[0][1]);
});

test('secrets never reach Gemma', () => {
  const { settled, forGemma } = precheck(toMessages(HELDOUT));
  assert.ok(forGemma.every((n) => findSecrets(n.text).length === 0));
  assert.equal(settled.filter((n) => n.kind === 'secret').length, HELDOUT.filter((r) => r[2] === 'secret').length);
});

test('with perfect guesses, the code gets every labelled due date right', () => {
  const rows = sorted(HELDOUT);
  const msgs = toMessages(HELDOUT);
  const { settled, forGemma } = precheck(msgs);
  const read = forGemma.map((n) => applyGuess(n, { n: 1, kind: rows[n.i][2], what: n.text, when: '' }));
  const notes = combine(settled, read);
  let wrong: string[] = [];
  for (const n of notes) {
    const [, text, kind, due] = rows[n.i];
    if (kind !== 'todo') continue;
    const got = n.when?.date ? n.when.date.toISOString().slice(0, 10) : null;
    if (n.when && !n.when.sure) continue; // flagged instead of guessed: allowed
    if (got !== due) wrong.push(`${text}: got ${got}, want ${due}`);
  }
  assert.deepEqual(wrong, []);
  const d = buildDigest(notes, NOW);
  assert.ok(d.today.length > 0 && d.counts.letGo > 0);
});

test('a broken JSON reply still yields the objects that parse', () => {
  const g = readGuesses('[{"n":1,"kind":"todo","what":"x"},{"n":2,"kind":"buy","what":"y"', 2);
  assert.equal(g[0]?.kind, 'todo');
});

test('a "who=""" slip from Gemma is repaired, not thrown away', () => {
  const g = readGuesses('[{"n":1,"kind":"todo","what":"car wash","when":"Sunday","who="""},\n{"n":2,"kind":"buy","what":"x","when":"","who=""}]', 2);
  assert.equal(g[0]?.kind, 'todo');
  assert.equal(g[0]?.when, 'Sunday');
  assert.equal(g[1]?.kind, 'buy');
});
