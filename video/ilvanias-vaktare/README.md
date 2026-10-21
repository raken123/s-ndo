# Ilvanias väktare – Sommarens bästa dag

En animerad film med berättarröst, gjord efter berättelsen om Alba, Vita ninjan,
som en kall höstmorgon ska resa till sommarfestivalen i hamnstaden Kingeri för
att träffa de andra väktarna.

**Filmen:** [`ilvanias-vaktare.mp4`](ilvanias-vaktare.mp4)

| | |
|---|---|
| Längd | 15:08 |
| Bild | 1920×1080, 24 bilder/s, H.264 |
| Ljud | AAC stereo, normaliserat till −16 LUFS |
| Undertexter | svenska (kan slås på i spelaren), även som [`undertext.srt`](undertext.srt) |

## Röster

| Roll | Röst |
|---|---|
| Berättaren | Sofie (sv-SE) |
| Alba | Sofie, ljusare och lite snabbare |
| Haji | Mattias (sv-SE) |
| Ninja King | Mattias, djupare och lugnare |
| Vida Nyckelbäraren | Sofie, mörkare och långsammare |

Rösterna är Microsofts svenska neurala talsyntes (via `edge-tts`).

## Manuset

Texten kom in som diktering, så taligenkänningen hade hört fel på många ställen.
[`manus.txt`](manus.txt) är den rättade versionen som filmen läser upp. Ändra där
och bygg om, så följer röst, bild och undertexter med.

Några namn och ord var svåra att höra och är gissningar. Säg till om något ska
stavas eller heta något annat:

| I filmen | Dikterat som |
|---|---|
| Ilvania | ilvania, ilvannia, ilvanas |
| Ninjali (där Alba bor) | nio, nijali, niali, innialia, nintenie |
| Kingeri (hamnstaden) | Kingerhi, tsinghua, king reij, tingeri |
| Stella, Gero, Adrian | Ställa, gero/gerro/gyro, adria |
| Eo (Albas kompis bland ninjorna) | Ue, eo, Eu, io, york |
| Haji (kocken) | haji, hajk, Harry, Hagia, harji |
| Ninja King, Vita ninjan, ninjadräkt | nya king, linneking, vita linjen, vitaminjan |
| Vida Nyckelbäraren | Vid en nyckelbäraren, vi där, fira |
| Äldsterådet | elterrådet, 11:e året, Önskemålet |
| Tysta salen (träningssalen) | tisdags, Tyskland |
| Master | master, mer |
| svartalfer, Glömskans gift, flugmonster | svartar, glömt hans skift, flugbox |
| ljussten | ljusängst, ljussängen |

## Scener

Titel · havet i storm · hamnen och blodmånen · Albas rum · festivalen i Kingeri ·
parken i Ninjali · minnet av Döda dalen · vännerna · väktarna förra sommaren ·
gongen · spången · Tysta salen · att se genom att känna · Haji · köket ·
Äldsterådet · köket igen · spegelstaven · Vidas ord · stationen · ljusstenen i
parken · inne i tåget · resan mot Kingeri · eftertext.

## Bygga om filmen

Allt – bilder, musik och ljudeffekter – skapas av koden i [`src/`](src); det finns
inga bild- eller ljudfiler att hämta. Endast rösten kräver nätverk.

```sh
python3 -m venv venv && . venv/bin/activate
pip install edge-tts numpy scipy
cd src && ./bygg.sh
```

| Fil | Gör |
|---|---|
| `src/tts.py` | läser manuset, talar in varje replik och bygger tidslinje och undertexter |
| `src/audio.py` | syntetiserar musik, havsbrus, vind, gong, fåglar, tåg m.m. och mixar under rösten |
| `src/lib.mjs`, `src/stage.mjs` | ritverktyg: landskap, träd, hav, partiklar och figurer i papperssnittsstil |
| `src/scenes1.mjs`, `src/scenes2.mjs` | de 25 scenerna, styrda av när varje replik sägs |
| `src/render.mjs` | ritar bildrutorna och skickar dem till ffmpeg; `--shots` ger stillbilder för kontroll |
| `src/bygg.sh` | kör allt i ordning och kodar den färdiga filmen |

Typsnitten är Cinzel och Cormorant Garamond (SIL Open Font License), som hämtas
via npm.
