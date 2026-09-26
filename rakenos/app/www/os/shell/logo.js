// The RakenOS mark: an "R" built from a vertical stem and a folded ribbon.
export function rakenMark(size = 56, { color = 'currentColor' } = {}) {
  return `<svg class="raken-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="10" width="9" height="44" rx="4.5" fill="${color}"/>
    <path d="M23 14.5h11.5a12.5 12.5 0 0 1 0 25H26l17 14.5" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
