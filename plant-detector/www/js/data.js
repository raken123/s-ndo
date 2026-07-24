/* ================= Kunskapsbas: växter & sjukdomar ================= */

const PLANTS = [
  { emoji: '🌿', name: 'Monstera', latin: 'Monstera deliciosa', light: 'Ljust, ej direkt sol', water: 'När ytan torkat, ca 1 g/vecka', difficulty: 'Lätt', problems: 'Gula blad (övervattning), bruna kanter (torr luft)' },
  { emoji: '🪴', name: 'Svärmorstunga', latin: 'Sansevieria trifasciata', light: 'Allt från skugga till sol', water: 'Sparsamt, var 2–3 vecka', difficulty: 'Mycket lätt', problems: 'Rotröta vid övervattning' },
  { emoji: '🌸', name: 'Orkidé', latin: 'Phalaenopsis', light: 'Ljust, ej direkt sol', water: 'Dopp i vatten 1 g/vecka', difficulty: 'Medel', problems: 'Slappa blad (uttorkning), gula blad (för mycket sol)' },
  { emoji: '🌱', name: 'Fredskalla', latin: 'Spathiphyllum', light: 'Halvskugga', water: 'Håll jorden lätt fuktig', difficulty: 'Lätt', problems: 'Hängande blad (törst), bruna spetsar (torr luft)' },
  { emoji: '🌵', name: 'Kaktus', latin: 'Cactaceae', light: 'Full sol', water: 'Mycket sparsamt, vila vintertid', difficulty: 'Mycket lätt', problems: 'Mjuk stam (rotröta), blek färg (ljusbrist)' },
  { emoji: '🍃', name: 'Gullranka', latin: 'Epipremnum aureum', light: 'Ljust till halvskugga', water: 'När ytan torkat', difficulty: 'Mycket lätt', problems: 'Tappar brokighet i mörker, gula blad vid blöt jord' },
  { emoji: '🌳', name: 'Fikus', latin: 'Ficus elastica', light: 'Ljust, tål viss sol', water: 'Måttligt, låt torka mellan', difficulty: 'Lätt', problems: 'Tappar blad vid flytt/drag, bladfläckar av svamp' },
  { emoji: '🌴', name: 'Kentiapalm', latin: 'Howea forsteriana', light: 'Ljust, ej direkt sol', water: 'Jämn fukt, ej blött', difficulty: 'Medel', problems: 'Bruna bladspetsar (torr luft), spinnkvalster' },
  { emoji: '🌺', name: 'Pelargon', latin: 'Pelargonium', light: 'Full sol', water: 'Rikligt sommartid', difficulty: 'Lätt', problems: 'Gråmögel i fukt, bladlöss' },
  { emoji: '🍅', name: 'Tomat', latin: 'Solanum lycopersicum', light: 'Full sol', water: 'Jämn och riklig fukt', difficulty: 'Medel', problems: 'Bladmögel, näringsbrist (gula blad), pistillröta' },
  { emoji: '🌾', name: 'Basilika', latin: 'Ocimum basilicum', light: 'Sol till ljust', water: 'Vattna underifrån, ofta', difficulty: 'Medel', problems: 'Vissnar snabbt vid torka, mjöldagg' },
  { emoji: '🌲', name: 'Suckulent', latin: 'Crassula, Echeveria m.fl.', light: 'Sol', water: 'Sparsamt, var 2–3 vecka', difficulty: 'Mycket lätt', problems: 'Sträcker sig i ljusbrist, röta vid väta' }
];

const DISEASES = [
  { emoji: '🟡', name: 'Gulnande blad (kloros)', symptom: 'Bladen tappar sin gröna färg och blir gula, ofta nedifrån och upp.',
    cause: 'Övervattning, näringsbrist (ofta kväve eller järn) eller för lite ljus.',
    action: 'Låt jorden torka upp, ge näring under växtsäsongen och flytta växten ljusare. Ta bort helt gula blad.' },
  { emoji: '🟤', name: 'Bruna bladspetsar', symptom: 'Spetsar och kanter torkar och blir bruna och sköra.',
    cause: 'Torr luft, för lite vatten eller salter från övergödsling.',
    action: 'Duscha bladen, vattna jämnare och skölj igenom jorden ett par gånger per år.' },
  { emoji: '⚫', name: 'Bladfläcksjuka', symptom: 'Mörka, ofta runda fläckar med gul ring runt om.',
    cause: 'Svamp eller bakterier — gynnas av väta på bladen och dålig luftcirkulation.',
    action: 'Ta bort angripna blad, vattna på jorden (inte bladen) och ge växten luftigare placering.' },
  { emoji: '⚪', name: 'Mjöldagg', symptom: 'Vit, mjölig beläggning på blad och skott.',
    cause: 'Svamp som trivs i torr luft med stora temperaturväxlingar.',
    action: 'Klipp bort angripna delar och spruta med såpvatten eller lösning av 1 del mjölk / 9 delar vatten.' },
  { emoji: '🕷️', name: 'Spinnkvalster', symptom: 'Fin spindelväv i bladveck, prickiga och blekt gråaktiga blad.',
    cause: 'Små kvalster som frodas i varm och torr luft.',
    action: 'Duscha växten ordentligt (även bladundersidor), höj luftfuktigheten och behandla med såpsprit.' },
  { emoji: '🐛', name: 'Bladlöss', symptom: 'Små gröna/svarta insekter på knoppar och skottspetsar, klibbiga blad.',
    cause: 'Följer ofta med nya växter eller snittblommor in.',
    action: 'Skölj av med ljummet vatten och behandla med såpsprit: 1 msk såpa + 1 tsk T-sprit per liter vatten.' },
  { emoji: '🍄', name: 'Rotröta', symptom: 'Växten hänger trots blöt jord, stammen mjuk, jorden luktar unket.',
    cause: 'För mycket vatten och syrebrist i jorden — rötterna kvävs och ruttnar.',
    action: 'Ta upp växten, klipp bort bruna rötter, plantera om i ny torr jord och vattna mycket försiktigt.' },
  { emoji: '🍂', name: 'Gråmögel', symptom: 'Grå, luden pälsliknande beläggning på blad, stjälkar eller blommor.',
    cause: 'Svamp (Botrytis) som gynnas av fukt, kyla och dålig ventilation.',
    action: 'Ta bort angripna delar direkt, vattna på morgonen och förbättra luftcirkulationen.' }
];
