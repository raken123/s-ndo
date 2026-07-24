/* ================= Bildanalys =================
   Analysen körs helt lokalt: bilden ritas ned till en liten canvas och
   pixlarna klassas per nyans (HSV) i vegetation, sjukdomstecken m.m.
   Utifrån andelarna beräknas växt-sannolikhet, hälsopoäng och diagnoser. */

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

function analyzeImage(img) {
  const size = 240;
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;

  let green = 0, yellow = 0, brown = 0, dark = 0, gray = 0, flower = 0, white = 0, other = 0;
  let hueSum = 0;
  const total = px.length / 4;

  for (let i = 0; i < px.length; i += 4) {
    const [h, s, v] = rgb2hsv(px[i], px[i + 1], px[i + 2]);
    if (v < 0.13) { dark++; continue; }
    if (s < 0.14) { (v > 0.82 ? white++ : gray++); continue; }
    if (h >= 65 && h <= 175) { green++; hueSum += h; }
    else if (h >= 42 && h < 65) yellow++;
    else if (h >= 12 && h < 42 && v < 0.72) brown++;
    else if ((h < 12 || h > 300) || (h >= 175 && h <= 300 && s > 0.3)) flower++;
    else other++;
  }

  const veg = green + yellow + brown;
  const greenShare = green / total;
  const vegShare = veg / total;
  const yellowShare = veg ? yellow / veg : 0;
  const brownShare = veg ? brown / veg : 0;
  const darkShare = dark / total;
  const flowerShare = flower / total;
  const whiteShare = white / total;
  const avgGreenHue = green ? hueSum / green : 0;

  // Växt-sannolikhet: främst grönt, med stöd av gul/brun vegetation
  const plantScore = Math.min(1, greenShare * 3.4 + yellow / total * 1.2 + brown / total * 0.5);
  const isPlant = plantScore >= 0.3;

  // Hälsopoäng: hur stor del av vegetationen som är frisk grön
  let health = veg ? Math.round((green / veg) * 100) : 0;
  if (darkShare > 0.3 && vegShare > 0.15) health = Math.max(0, health - 10);

  const diagnoses = [];
  const tags = [];

  if (!isPlant) {
    return { isPlant, plantScore, health: null, tags, diagnoses, flowerShare, thumb: makeThumb(c) };
  }

  if (yellowShare > 0.45) {
    diagnoses.push({ ico: '🟡', title: 'Kraftig gulning (kloros)', text: 'En stor del av växten är gul. Vanliga orsaker är övervattning eller näringsbrist. Låt jorden torka upp och ge näring under växtsäsongen.' });
    tags.push({ t: 'Gula blad', cls: 'bad' });
  } else if (yellowShare > 0.2) {
    diagnoses.push({ ico: '🟡', title: 'Viss gulning', text: 'Delar av växten gulnar. Kontrollera vattning och ljus — enstaka gula åldersblad är dock helt normalt.' });
    tags.push({ t: 'Lätt gulning', cls: 'warn' });
  }

  if (brownShare > 0.35) {
    diagnoses.push({ ico: '🟤', title: 'Omfattande bruna partier', text: 'Mycket brunt tyder på uttorkning, solbränna eller svampsjukdom som bladfläcksjuka. Klipp bort skadade delar och se guiden.' });
    tags.push({ t: 'Bruna partier', cls: 'bad' });
  } else if (brownShare > 0.15) {
    diagnoses.push({ ico: '🟤', title: 'Bruna inslag', text: 'Bruna spetsar eller fläckar syns. Ofta torr luft eller ojämn vattning — duscha bladen och vattna jämnare.' });
    tags.push({ t: 'Bruna spetsar', cls: 'warn' });
  }

  if (darkShare > 0.28 && vegShare > 0.2) {
    diagnoses.push({ ico: '⚫', title: 'Mörka fläckar', text: 'Mörka partier i bladverket kan vara bladfläcksjuka (svamp). Vattna på jorden i stället för bladen och ge luftigare placering.' });
    tags.push({ t: 'Mörka fläckar', cls: 'warn' });
  }

  if (whiteShare > 0.18 && vegShare > 0.25) {
    diagnoses.push({ ico: '⚪', title: 'Ljus beläggning', text: 'Vita/ljusa partier på bladen kan vara mjöldagg. Jämför med sjukdomsguiden och behandla med såpvatten vid behov.' });
    tags.push({ t: 'Möjlig mjöldagg', cls: 'warn' });
  }

  if (flowerShare > 0.06) {
    tags.push({ t: '🌸 Blommande växt', cls: 'info' });
  }
  if (avgGreenHue > 140 && greenShare > 0.1) {
    tags.push({ t: 'Blågrön ton — suckulent/barr?', cls: 'info' });
  }

  if (!diagnoses.length) {
    diagnoses.push({ ico: '✅', title: 'Inga tydliga sjukdomstecken', text: 'Växten ser frisk och grön ut på bilden. Fortsätt med samma skötsel!' });
    tags.unshift({ t: 'Frisk & grön', cls: '' });
  }

  return { isPlant, plantScore, health, tags, diagnoses, flowerShare, thumb: makeThumb(c) };
}

function makeThumb(canvas) {
  const t = document.createElement('canvas');
  const s = 96;
  const ratio = Math.max(s / canvas.width, s / canvas.height);
  t.width = s; t.height = s;
  const w = canvas.width * ratio, h = canvas.height * ratio;
  t.getContext('2d').drawImage(canvas, (s - w) / 2, (s - h) / 2, w, h);
  return t.toDataURL('image/jpeg', 0.7);
}
