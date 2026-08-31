/** Tal in och ut. Allt som går att göra med rösten ska gå att göra med rösten —
 *  händerna hör hemma på ratten. */
import { emit } from './bus.js';
import { state } from './store.js';

const synth = window.speechSynthesis;
let voices = [];

function loadVoices() {
  voices = synth?.getVoices?.() ?? [];
}
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);

function pickVoice() {
  if (!voices.length) loadVoices();
  return voices.find((v) => v.lang === 'sv-SE')
    ?? voices.find((v) => v.lang?.startsWith('sv'))
    ?? voices.find((v) => v.default)
    ?? voices[0]
    ?? null;
}

/** Säg något. `force` läser upp även när röstsvar är avslaget (t.ex. larm). */
export function say(text, { force = false, interrupt = true } = {}) {
  if (!synth || !text) return;
  if (!state.settings.voice && !force) return;
  if (interrupt) synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? 'sv-SE';
  utter.rate = state.settings.voiceRate ?? 1;
  utter.pitch = 1;
  synth.speak(utter);
}

export function hush() {
  synth?.cancel();
}

/* ---------- Igenkänning ---------- */
const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

let recognition = null;
let listening = false;

export function listen() {
  return new Promise((resolve, reject) => {
    if (!Recognition) { reject(new Error('Rösttolkning stöds inte i den här webbläsaren.')); return; }
    if (listening) { stopListening(); }

    recognition = new Recognition();
    recognition.lang = 'sv-SE';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalText = '';
    let settled = false;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      emit('speech:partial', (finalText + interim).trim());
    };
    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      listening = false;
      const msg = event.error === 'not-allowed'
        ? 'Mikrofonen är blockerad. Tillåt mikrofon för ReeOS.'
        : event.error === 'no-speech' ? 'Hörde inget.' : 'Rösttolkningen avbröts.';
      reject(new Error(msg));
    };
    recognition.onend = () => {
      listening = false;
      emit('speech:end');
      if (settled) return;
      settled = true;
      const text = finalText.trim();
      if (text) resolve(text);
      else reject(new Error('Hörde inget.'));
    };

    listening = true;
    emit('speech:start');
    try { recognition.start(); }
    catch { listening = false; reject(new Error('Kunde inte starta mikrofonen.')); }
  });
}

export function stopListening() {
  try { recognition?.stop(); } catch { /* redan stoppad */ }
  listening = false;
}

export const isListening = () => listening;
