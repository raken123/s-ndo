/** Musik från telefonens egna filer. Ingen inloggning, ingen strömning —
 *  spellistan fungerar i tunneln och på grusvägen. */
import { el, icon, toast, fmtTime, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state } from '../core/store.js';
import { sensors } from '../core/sensors.js';

const audio = new Audio();
audio.preload = 'metadata';

const player = {
  queue: [],       // { id, title, artist, url, file }
  index: -1,
  shuffle: false,
  repeat: false,
  baseVolume: 0.8,
};

/* ---------- Fartanpassad volym ----------
   Vägbruset ökar ungefär med farten. Lyft volymen sakta upp till +25 %
   mellan 50 och 120 km/h så att man slipper skruva under körning. */
function applyVolume() {
  let volume = player.baseVolume;
  if (state.settings.speedVolume) {
    const kmh = Math.min(Math.max(sensors.speedKmh, 50), 120);
    volume *= 1 + ((kmh - 50) / 70) * 0.25;
  }
  audio.volume = Math.min(1, Math.max(0, volume));
}

function titleFromFile(name) {
  const clean = name.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  const parts = clean.split(' - ');
  return parts.length > 1
    ? { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
    : { artist: 'Okänd artist', title: clean.trim() };
}

export function addFiles(fileList) {
  const added = [...fileList]
    .filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(file.name))
    .map((file) => ({ id: `${file.name}-${file.size}`, ...titleFromFile(file.name), url: URL.createObjectURL(file), file }));

  if (!added.length) { toast('Inga ljudfiler i urvalet.', 'warn'); return 0; }
  player.queue.push(...added);
  emit('music:queue', player.queue);
  if (player.index < 0) playAt(0);
  return added.length;
}

export function playAt(index) {
  if (!player.queue.length) return;
  player.index = (index + player.queue.length) % player.queue.length;
  const track = player.queue[player.index];
  audio.src = track.url;
  applyVolume();
  audio.play().catch(() => toast('Tryck på play för att starta ljudet.', 'warn'));
  emit('music:track', track);
}

export function togglePlay() {
  if (!player.queue.length) { toast('Lägg till musik först.', 'warn'); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

export const next = () => {
  if (!player.queue.length) return;
  playAt(player.shuffle ? Math.floor(Math.random() * player.queue.length) : player.index + 1);
};

export const prev = () => {
  if (!player.queue.length) return;
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  playAt(player.index - 1);
};

export const isPlaying = () => !audio.paused && player.queue.length > 0;
export const currentTrack = () => player.queue[player.index] ?? null;

export function setVolume(value) {
  player.baseVolume = Math.min(1, Math.max(0, value));
  applyVolume();
}

audio.addEventListener('ended', () => {
  if (player.repeat) { audio.currentTime = 0; audio.play(); return; }
  next();
});
audio.addEventListener('play', () => emit('music:state', true));
audio.addEventListener('pause', () => emit('music:state', false));
on('sensors:fix', applyVolume);

/* Låsskärmens mediaknappar och rattens knappar går via Media Session. */
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => audio.play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack', next);
  navigator.mediaSession.setActionHandler('previoustrack', prev);
  on('music:track', (track) => {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: track.artist, album: 'ReeOS',
    });
  });
}

export const musicApp = {
  id: 'music',
  name: 'Musik',
  icon: 'music',
  dock: true,

  mount(root) {
    const art = el('div', { class: 'art' }, icon('music'));
    const title = el('div', { class: 'track-title', text: 'Ingen låt vald' });
    const sub = el('div', { class: 'track-sub', text: 'Lägg till musik från telefonen' });
    const seekFill = el('i');
    const timeNow = el('span', { text: '0:00' });
    const timeEnd = el('span', { text: '0:00' });
    const playBtn = el('button', { class: 'tbtn play', 'aria-label': 'Spela', onClick: () => { togglePlay(); buzz(); } }, icon('play'));
    const shuffleBtn = el('button', { class: 'tbtn tiny', 'aria-label': 'Blanda', onClick: () => { player.shuffle = !player.shuffle; syncModes(); } }, icon('shuffle'));
    const repeatBtn = el('button', { class: 'tbtn tiny', 'aria-label': 'Upprepa', onClick: () => { player.repeat = !player.repeat; syncModes(); } }, icon('repeat'));
    const queueList = el('div', { class: 'list' });

    const picker = el('input', { type: 'file', accept: 'audio/*', multiple: true, class: 'sr-only' });
    picker.addEventListener('change', () => {
      const count = addFiles(picker.files);
      if (count) toast(`${count} låtar tillagda.`, 'ok');
      picker.value = '';
      renderQueue();
    });

    const seekRail = el('div', { class: 'seek-rail' }, seekFill);
    seekRail.addEventListener('click', (ev) => {
      if (!audio.duration) return;
      const rect = seekRail.getBoundingClientRect();
      audio.currentTime = ((ev.clientX - rect.left) / rect.width) * audio.duration;
    });

    const volume = el('input', { type: 'range', min: '0', max: '100', value: String(player.baseVolume * 100), class: 'grow' });
    volume.addEventListener('input', () => setVolume(Number(volume.value) / 100));

    root.append(
      el('div', { class: 'player' },
        art, title, sub,
        el('div', { class: 'seek' }, seekRail, el('div', { class: 'seek-times' }, timeNow, timeEnd)),
        el('div', { class: 'transport' },
          shuffleBtn,
          el('button', { class: 'tbtn', 'aria-label': 'Föregående', onClick: prev }, icon('prev')),
          playBtn,
          el('button', { class: 'tbtn', 'aria-label': 'Nästa', onClick: next }, icon('next')),
          repeatBtn,
        ),
        el('div', { class: 'row', style: 'width:100%;align-items:center;gap:12px' }, icon('volume'), volume),
      ),
      el('div', { class: 'card' },
        el('div', { class: 'spread', style: 'margin-bottom:10px' },
          el('h3', { style: 'margin:0', text: 'Spellista' }),
          el('button', { class: 'btn small primary', onClick: () => picker.click() }, icon('plus'), 'Lägg till'),
        ),
        queueList,
        picker,
      ),
      el('p', { class: 'hint', style: 'margin-top:10px', text: state.settings.speedVolume
        ? 'Fartanpassad volym är på — ljudet lyfts något i högre fart.'
        : 'Fartanpassad volym är av. Slå på den i Inställningar.' }),
    );

    function syncModes() {
      shuffleBtn.classList.toggle('on', player.shuffle);
      repeatBtn.classList.toggle('on', player.repeat);
    }

    function renderNow() {
      const track = currentTrack();
      title.textContent = track?.title ?? 'Ingen låt vald';
      sub.textContent = track ? track.artist : 'Lägg till musik från telefonen';
      setKids(playBtn, icon(isPlaying() ? 'pause' : 'play'));
      art.classList.toggle('spin', isPlaying());
      renderQueue();
    }

    function renderProgress() {
      const ratio = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      seekFill.style.width = `${ratio}%`;
      timeNow.textContent = fmtTime(audio.currentTime);
      timeEnd.textContent = fmtTime(audio.duration);
    }

    function renderQueue() {
      setKids(queueList, 
        ...player.queue.map((track, i) => el('button', {
          class: 'list-item', onClick: () => playAt(i),
          style: i === player.index ? 'border-color:var(--r-brand)' : null,
        },
          el('span', { class: 'avatar' }, icon(i === player.index && isPlaying() ? 'pause' : 'play')),
          el('div', { class: 'li-main' }, el('b', { text: track.title }), el('small', { text: track.artist })),
        )),
        player.queue.length ? null : el('div', { class: 'empty' },
          el('b', { text: 'Tom spellista' }),
          el('span', { class: 'hint', text: 'Välj låtar från telefonens minne. De ligger kvar så länge ReeOS är öppet.' })),
      );
    }

    syncModes();
    renderNow();
    renderProgress();

    const unbind = [on('music:track', renderNow), on('music:state', renderNow), on('music:queue', renderQueue)];
    audio.addEventListener('timeupdate', renderProgress);
    audio.addEventListener('loadedmetadata', renderProgress);

    return () => {
      unbind.forEach((fn) => fn());
      audio.removeEventListener('timeupdate', renderProgress);
      audio.removeEventListener('loadedmetadata', renderProgress);
    };
  },
};
