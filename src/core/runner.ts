// Slow and steady. Gemma reads eight notes at a time, and every answer is saved the moment it
// arrives, so closing the tab, a dead battery or a sleeping laptop only costs the batch in flight.
// Open the same chat again and it picks up where it stopped.

import { applyGuess, combine, precheck, type Note } from './notes.ts';
import { BATCH, promptFor, readGuesses } from './prompt.ts';
import type { Message } from './whatsapp.ts';

export interface Store {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export interface Progress {
  done: number; // notes read so far (including ones code settled)
  total: number;
  batch: number;
  batches: number;
  resumed: number; // batches that came from a saved run
  msPerBatch: number | null;
}

export type Ask = (prompt: string) => Promise<string>;

/** A short fingerprint of the chat, so saved answers are only reused for the same notes. */
export async function chatKey(messages: Message[]): Promise<string> {
  const text = messages.map((m) => m.at.toISOString() + m.text).join('\n');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readChat(
  messages: Message[],
  ask: Ask,
  store: Store,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<Note[]> {
  const key = await chatKey(messages);
  const { settled, forGemma } = precheck(messages);
  const batches: Note[][] = [];
  for (let k = 0; k < forGemma.length; k += BATCH) batches.push(forGemma.slice(k, k + BATCH));

  const read: Note[] = [];
  let resumed = 0;
  let spent = 0;
  let asked = 0;
  const report = (b: number) =>
    onProgress({
      done: settled.length + read.length,
      total: messages.length,
      batch: b,
      batches: batches.length,
      resumed,
      msPerBatch: asked ? spent / asked : null,
    });
  report(0);

  for (let b = 0; b < batches.length; b++) {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const batch = batches[b];
    const slot = `bm:${key}:${b}`;
    let reply = await store.get(slot);
    if (reply !== undefined) {
      resumed++;
    } else {
      const t0 = performance.now();
      reply = await ask(promptFor(batch));
      // A reply Gemma garbled completely gets one more try before its notes are marked unsure.
      if (readGuesses(reply, batch.length).every((g) => !g)) reply = await ask(promptFor(batch));
      spent += performance.now() - t0;
      asked++;
      await store.set(slot, reply);
    }
    const guesses = readGuesses(reply, batch.length);
    batch.forEach((n, k) => read.push(applyGuess(n, guesses[k])));
    report(b + 1);
  }
  return combine(settled, read);
}

/** Replay recorded answers (the example in the app uses Gemma's real replies, saved from a run). */
export function replayStore(replies: string[], key: string): Store {
  return {
    async get(slot) {
      const [, k, b] = slot.split(':');
      return k === key ? replies[Number(b)] : undefined;
    },
    async set() {},
  };
}
