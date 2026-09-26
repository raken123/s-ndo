# Färdiga filer

| Fil | Vad |
|---|---|
| `JomniBlommor-unsigned.ipa` | iPhone-appen (osignerad, iOS 16+). Byggd av GitHub Actions. Se [../APP-STORE.md](../APP-STORE.md) för App Store/TestFlight. |
| `jomni-blommor.html` | Webbutiken i en enda fil (CSS och JS inbäddat). |
| `jomni-admin.html` | Adminsidan i en enda fil. |

HTML-filerna pratar med servern på `https://jomniblommor.se`. Bygg om dem mot er egen serveradress:

```bash
cd jomni-blommor/server
npm run build:html -- https://din-server.se
```

Om filerna ligger på en annan domän än servern (t.ex. GitHub Pages), lägg domänen i `CORS_ORIGINS` i serverns `.env`, t.ex. `CORS_ORIGINS=https://raken123.github.io`.

Enklast är annars att köra servern – den serverar samma sidor direkt på `/` och `/admin`.
