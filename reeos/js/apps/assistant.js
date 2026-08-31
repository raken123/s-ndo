/** Röstassistenten. Tolkar svenska kommandon lokalt — inga fraser skickas
 *  vidare någonstans, och den svarar även utan nät. */
import { el, toast, fmtDistance, fmtDuration, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state } from '../core/store.js';
import { listen, say, stopListening, canListen } from '../core/speech.js';
import { open } from '../core/router.js';
import { sensors, here, distanceBetween } from '../core/sensors.js';
import { navigateTo, geocode, clearRoute, currentDestination } from './nav.js';
import { togglePlay, next, prev, isPlaying, currentTrack } from './music.js';
import { callContactByName } from './phone.js';
import { saveSpot, clearSpot } from './parking.js';
import { reportHazard, HAZARD_KINDS } from './alerts.js';
import { tripStatus, startTrip, endTrip } from './triplog.js';
import { fatigueStatus, takeBreak } from './fatigue.js';
import { saveEvent, camRunning, startCam } from './dashcam.js';

const has = (text, ...words) => words.some((word) => text.includes(word));

/** Tolka en mening och utför den. Returnerar svaret som ska läsas upp. */
export async function handleCommand(raw) {
  const text = raw.toLowerCase().trim();
  if (!text) return 'Jag hörde inget.';

  /* --- navigation --- */
  if (has(text, 'kör mig till', 'navigera till', 'ta mig till', 'åk till')) {
    const target = text.replace(/.*?(kör mig till|navigera till|ta mig till|åk till)\s*/, '').trim();
    if (!target) return 'Vart vill du åka?';

    const saved = state.places.find((p) => p.lat != null && p.label.toLowerCase().includes(target));
    if (saved) { await navigateTo(saved); return `Kör mot ${saved.label}.`; }

    try {
      const [hit] = await geocode(target);
      if (!hit) return `Jag hittar ingen plats som heter ${target}.`;
      await navigateTo(hit);
      return `Kör mot ${hit.label}.`;
    } catch {
      return 'Jag når inte kartsökningen just nu. Välj en sparad plats i stället.';
    }
  }

  if (has(text, 'avbryt rutt', 'avsluta rutt', 'sluta navigera')) {
    clearRoute();
    return 'Rutten är avslutad.';
  }

  // "hur långt har jag kört" handlar om färddagboken, inte om färdmålet.
  if (has(text, 'hur långt', 'hur lång tid', 'när är jag framme') && !has(text, 'har jag kört')) {
    const dest = currentDestination();
    if (!dest) return 'Du har inget färdmål inlagt.';
    const remaining = distanceBetween(here(), dest);
    const speed = sensors.speedKmh > 5 ? sensors.speedKmh : 60;
    return `${fmtDistance(remaining)} kvar till ${dest.label}, ungefär ${Math.round(remaining / 1000 / speed * 60)} minuter.`;
  }

  /* --- musik --- */
  if (has(text, 'spela musik', 'spela upp', 'starta musiken')) {
    if (!isPlaying()) togglePlay();
    open('music');
    const track = currentTrack();
    return track ? `Spelar ${track.title}.` : 'Lägg till musik först.';
  }
  if (has(text, 'pausa', 'stoppa musiken', 'tyst')) {
    if (isPlaying()) togglePlay();
    return 'Pausad.';
  }
  if (has(text, 'nästa låt', 'nästa spår')) { next(); return 'Nästa låt.'; }
  if (has(text, 'föregående låt', 'förra låten')) { prev(); return 'Föregående låt.'; }
  if (has(text, 'vad spelas', 'vilken låt')) {
    const track = currentTrack();
    return track ? `${track.title} med ${track.artist}.` : 'Ingen låt spelas.';
  }

  /* --- telefon --- */
  if (has(text, 'ring ')) {
    const name = text.split('ring ')[1]?.replace(/\s+(upp|till)\s+/, ' ').trim();
    if (!name) return 'Vem vill du ringa?';
    const result = callContactByName(name);
    return result.ok ? `Ringer ${result.contact.name}.` : result.reason;
  }

  /* --- parkering --- */
  if (has(text, 'spara parkering', 'kom ihåg var jag parkerat', 'spara p-plats', 'här står bilen')) {
    try { await saveSpot({ note: 'Sparad med rösten' }); open('parking'); return 'Parkeringen är sparad.'; }
    catch (err) { return err.message; }
  }
  if (has(text, 'var står bilen', 'var är bilen', 'hitta bilen')) {
    if (!state.parking) return 'Du har ingen sparad parkering.';
    open('parking');
    const distance = distanceBetween(here(), state.parking);
    return Number.isFinite(distance) ? `Bilen står ${fmtDistance(distance)} härifrån.` : 'Jag visar parkeringen på skärmen.';
  }
  if (has(text, 'glöm parkeringen', 'rensa parkering')) { clearSpot(); return 'Parkeringen är rensad.'; }

  /* --- väglag --- */
  if (has(text, 'markera', 'rapportera', 'varna för')) {
    const kind = Object.entries(HAZARD_KINDS).find(([key, value]) =>
      text.includes(value.label.toLowerCase()) || text.includes(key)
      || (key === 'pothole' && has(text, 'hål', 'grop'))
      || (key === 'ice' && has(text, 'halt', 'halka', 'is'))
      || (key === 'wildlife' && has(text, 'älg', 'rådjur', 'djur', 'vilt'))
      || (key === 'queue' && has(text, 'kö', 'stopp'))
      || (key === 'roadwork' && has(text, 'vägarbete', 'arbete'))
      || (key === 'camera' && has(text, 'kamera', 'fartkamera')));
    if (!kind) { emit('alerts:quickreport'); return 'Vad ska jag markera?'; }
    reportHazard(kind[0]);
    return `${kind[1].label} markerat här.`;
  }

  /* --- färddagbok --- */
  if (has(text, 'starta resa', 'börja logga')) { startTrip(true); return 'Resan loggas.'; }
  if (has(text, 'avsluta resa', 'sluta logga')) {
    const purpose = has(text, 'tjänst', 'jobb') ? 'tjänst' : 'privat';
    const trip = endTrip({ purpose });
    if (!trip) return 'Ingen resa pågick.';
    return trip.recorded
      ? `Resa sparad: ${trip.km.toFixed(1)} kilometer som ${purpose}.`
      : 'Resan var för kort för att sparas.';
  }
  if (has(text, 'hur långt har jag kört')) {
    const status = tripStatus();
    return status.active ? `${status.km.toFixed(1)} kilometer den här resan.` : `Totalt ${state.stats.totalKm.toFixed(0)} kilometer loggat.`;
  }

  /* --- trötthet --- */
  if (has(text, 'jag tar paus', 'nu rastar jag', 'nollställ körtid')) { takeBreak(); return 'Körtiden är nollställd. Sträck på benen.'; }
  if (has(text, 'hur länge har jag kört', 'är jag trött')) {
    const status = fatigueStatus();
    return `Du har kört ${fmtDuration(status.drivingMs)} sedan senaste pausen.` + (status.dueForBreak ? ' Det är dags att stanna.' : '');
  }

  /* --- dashcam --- */
  if (has(text, 'spara klipp', 'spara händelse', 'filma det där')) {
    if (!camRunning()) { try { await startCam(); } catch (err) { return err.message; } }
    const meta = await saveEvent('röstkommando');
    return meta ? 'Klippet är sparat.' : 'Bufferten är inte fylld ännu.';
  }

  /* --- fart och status --- */
  if (has(text, 'hur fort', 'vilken hastighet')) return `Du kör ${Math.round(sensors.speedKmh)} kilometer i timmen.`;
  if (has(text, 'vad är klockan')) return `Klockan är ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}.`;

  /* --- öppna appar --- */
  const screens = {
    karta: 'nav', navigation: 'nav', musik: 'music', telefon: 'phone',
    meddelanden: 'messages', dashcam: 'dashcam', parkering: 'parking',
    färddagbok: 'triplog', väglag: 'alerts', hud: 'hud', inställningar: 'settings', hem: 'home',
  };
  if (has(text, 'öppna', 'visa', 'gå till')) {
    const match = Object.entries(screens).find(([word]) => text.includes(word));
    if (match) { open(match[1]); return `Öppnar ${match[0]}.`; }
  }

  if (has(text, 'hjälp', 'vad kan du')) {
    return 'Säg till exempel: kör mig till Lund, ring hemma, spela musik, spara parkering, markera hål i vägen, eller jag tar paus.';
  }

  return 'Det där förstod jag inte. Säg hjälp för exempel.';
}

/** Öppnar lyssningsvyn och kör kommandot som hörs. */
export async function askAssistant() {
  const overlay = document.getElementById('assistant-overlay');
  const heard = el('div', { class: 'heard', text: '' });
  const said = el('div', { class: 'said', text: 'Lyssnar…' });

  if (!canListen) {
    // Utan rösttolkning får man skriva — men bara när bilen står stilla.
    if (sensors.driving) { toast('Rösttolkning saknas i den här webbläsaren.', 'err'); return; }
    const typed = prompt('Vad vill du göra?');
    if (typed) {
      const reply = await handleCommand(typed);
      say(reply);
      toast(reply, '', 5000);
    }
    return;
  }

  overlay.hidden = false;
  setKids(overlay, 
    el('div', { class: 'orb' }),
    heard,
    said,
    el('button', { class: 'btn', onClick: close, text: 'Avbryt' }),
  );

  function close() {
    stopListening();
    overlay.hidden = true;
    unbind();
  }
  const unbind = on('speech:partial', (text) => { heard.textContent = text; });

  try {
    const text = await listen();
    heard.textContent = text;
    said.textContent = 'Tänker…';
    const reply = await handleCommand(text);
    said.textContent = reply;
    say(reply);
    setTimeout(close, 2200);
  } catch (err) {
    said.textContent = err.message;
    setTimeout(close, 1800);
  }
}
