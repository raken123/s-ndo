// Butikens katalog, leveranszoner och lojalitetsregler.
// Allt som butiksägaren kan tänkas vilja ändra ligger samlat här.

export const SHOP = {
  name: 'Jomni Blommor',
  timezone: 'Europe/Stockholm',
  currency: 'sek',
  country: 'SE',
};

// Standardlösenord för adminsidan (scrypt-hash, lösenordet står inte i klartext).
// Sätt miljövariabeln ADMIN_PASSWORD för att byta lösenord i produktion.
export const DEFAULT_ADMIN_PASSWORD_HASH =
  'scrypt$17$a1tAXffrHWMCcxI+jAwBJQ==$OhARlz8tZGYlWMzYpWZIi2l1kL1FKP1v67g8sXAPdXQ=';

// Priser i hela kronor. `colors` styr bukettillustrationen (blommor, blad, papper).
export const PRODUCTS = [
  { id: 'rosa-drommar', name: 'Rosa Drömmar', price: 449, category: 'Rosor',
    description: 'Tolv skira rosa rosor med eukalyptus och brudslöja.',
    colors: ['#f4a7b9', '#f8c8d4', '#e88aa3'], leaf: '#7fa487', paper: '#fbeff2' },
  { id: 'klassisk-rod', name: 'Klassisk Röd', price: 549, category: 'Rosor',
    description: 'Femton djupröda rosor – den tidlösa kärleksförklaringen.',
    colors: ['#c0283d', '#d9394f', '#a51f33'], leaf: '#5d8a63', paper: '#f5e9e4' },
  { id: 'solsken', name: 'Solsken', price: 349, category: 'Säsong',
    description: 'Solrosor, kamomill och gula tulpaner som lyser upp vilket rum som helst.',
    colors: ['#f6c343', '#fbd96a', '#f2a93b'], leaf: '#6f9a5b', paper: '#fdf6e3' },
  { id: 'varbris', name: 'Vårbris', price: 299, category: 'Tulpaner',
    description: 'Femton blandade tulpaner i pastell – vårens första hälsning.',
    colors: ['#f7a8c4', '#fcd5a5', '#c9b6f2'], leaf: '#88b07a', paper: '#f3f7ee' },
  { id: 'midsommar', name: 'Midsommar', price: 379, category: 'Säsong',
    description: 'Ängsblommor, prästkragar och blåklint plockade som på en sommaräng.',
    colors: ['#ffffff', '#6f8fd8', '#f5d76e'], leaf: '#7aa56a', paper: '#eef4fb' },
  { id: 'lavendelhav', name: 'Lavendelhav', price: 399, category: 'Säsong',
    description: 'Lavendel, lila statice och silverblad med en doft av Provence.',
    colors: ['#9b87d6', '#b9a6e8', '#7d68c2'], leaf: '#8aa39a', paper: '#f2effa' },
  { id: 'vit-elegans', name: 'Vit Elegans', price: 499, category: 'Liljor',
    description: 'Vita liljor, rosor och ranunkler – stilrent för högtid och sorg.',
    colors: ['#ffffff', '#f4f1ea', '#e9e4d8'], leaf: '#6c9277', paper: '#f1f3f1' },
  { id: 'pion-lyx', name: 'Pion Lyx', price: 599, category: 'Pioner',
    description: 'Frodiga pioner i korall och rosa. Vår mest generösa bukett.',
    colors: ['#f28b82', '#f7b2ad', '#ec6f73'], leaf: '#6f9a74', paper: '#fdeeea' },
  { id: 'hostglod', name: 'Höstglöd', price: 429, category: 'Säsong',
    description: 'Dahlior, rönnbär och torkat gräs i varma höstfärger.',
    colors: ['#e0773b', '#c9523a', '#f0a45d'], leaf: '#8a8f55', paper: '#f7ede3' },
  { id: 'liten-halsning', name: 'Liten Hälsning', price: 199, category: 'Mini',
    description: 'En liten bukett säsongens blommor – perfekt som tack eller grattis.',
    colors: ['#f6b5c8', '#fde29b', '#b7d9f2'], leaf: '#7fae83', paper: '#f7f4ef' },
];

// Leveranstider (lokal tid i SHOP.timezone).
export const SLOTS = [
  { id: '09-12', label: '09–12', start: 9, end: 12 },
  { id: '12-15', label: '12–15', start: 12, end: 15 },
  { id: '15-18', label: '15–18', start: 15, end: 18 },
  { id: '18-21', label: '18–21', start: 18, end: 21 },
];

// Leveranszoner matchas på postnummer (5 siffror) i ordning; första träffen gäller.
// Justera intervallen så att de motsvarar området där ni kör ut själva.
export const ZONES = [
  { id: 'bud', name: 'Budleverans', description: 'Vi kör ut buketten själva inom valt tidsfönster.',
    from: 10000, to: 19999, fee: 89, freeOver: 799, sameDay: true, slots: true,
    prepHours: 2, maxDaysAhead: 60 },
  { id: 'postnord', name: 'PostNord Hem', description: 'Levereras i skyddande låda, 1–2 vardagar.',
    from: 10000, to: 98499, fee: 149, freeOver: null, sameDay: false, slots: false,
    minDaysAhead: 2, weekdaysOnly: true, maxDaysAhead: 60 },
];

// Lojalitet. Heltal används internt för att undvika avrundningsfel:
//   mynt lagras i tusendelar (milli-mynt), diamanter i miljondelar (mikro-diamanter).
//   150 kr = 0,3 mynt  → 2 milli-mynt per krona.
//   20 mynt = 0,12 diamanter → 6 mikro-diamanter per milli-mynt.
export const LOYALTY = {
  milliCoinsPerKrona: 2,
  microDiamondsPerMilliCoin: 6,
  plusMultiplier: 2,
};

export const PLUS = {
  name: 'Jomni Plus',
  priceKr: 48,
  interval: 'month',
  appleProductId: 'se.jomni.blommor.plus.monthly',
};

// Belöningar som köps med diamanter (kostnad i mikro-diamanter).
export const REWARDS = [
  { id: 'free-delivery', name: 'Gratis leverans', cost: 30000, discount: { type: 'free_delivery', value: 0 } },
  { id: 'pct-10', name: '10 % rabatt', cost: 50000, discount: { type: 'percent', value: 10 } },
  { id: 'pct-25', name: '25 % rabatt', cost: 100000, discount: { type: 'percent', value: 25 } },
  { id: 'free-bouquet', name: 'Gratis bukett (upp till 449 kr)', cost: 120000, discount: { type: 'free_bouquet', value: 449 } },
];

// Vad det kostar i stjärnor för admin att skapa en rabattkod.
export function starCost(type, value) {
  if (type === 'percent') return Math.max(1, Math.round(value));
  if (type === 'amount') return Math.max(1, Math.ceil(value / 10));
  if (type === 'free_delivery') return 5;
  if (type === 'free_bouquet') return Math.max(1, Math.ceil(value / 10));
  return Infinity;
}

export const ORDER_STATUSES = [
  { id: 'awaiting_payment', label: 'Väntar på betalning' },
  { id: 'paid', label: 'Mottagen' },
  { id: 'preparing', label: 'Binds' },
  { id: 'out_for_delivery', label: 'Ute för leverans' },
  { id: 'delivered', label: 'Levererad' },
  { id: 'cancelled', label: 'Avbruten' },
];
