// Open /eval.html in a WebGPU browser. Same Gemma, same runtime, same code as the app.
// /eval.html?run=dev,heldout,dates starts straight away (for unattended runs).
import { loadGemma, generate } from '../src/llm.ts';
import { runEval } from './bench.ts';

const out = document.querySelector('#log')!;
const log = (line: string) => {
  out.textContent += line + '\n';
  console.log(line);
};

async function go(which: string[]) {
  await loadGemma((m) => (document.title = m));
  document.title = 'running';
  const result = await runEval(generate, log, which);
  (window as unknown as { result: unknown }).result = result;
  await fetch('/__save-eval', { method: 'POST', body: JSON.stringify({ ua: navigator.userAgent, at: new Date().toISOString(), ...result }, null, 2) }).catch(() => {});
  document.title = 'done';
}

document.querySelector('#go')!.addEventListener('click', () => {
  const which = (document.querySelector('#only') as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
  go(which).catch((e) => log('ERROR ' + e));
});
const auto = new URLSearchParams(location.search).get('run');
if (auto !== null) go(auto.split(',').filter(Boolean)).catch((e) => {
  log('ERROR ' + e);
  document.title = 'error';
});
