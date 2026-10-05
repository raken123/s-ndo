# Appen utan namn – Munkmoraskolan

Lyssnar i klassrummet. Var 15:e sekund skickas en ljudinspelning från mikrofonen
till Google Gemini (`gemini-3.8-flash`). Om AI:n hör en klassklown som tramsar
piper appen och säger **"Sluta tramsa!"**.

## Filer

| Fil | Vad |
| --- | --- |
| `dist/app.apk` | Android-appen (byggs automatiskt av GitHub Actions) |
| `dist/app.html` / `web/index.html` | Samma app för webbläsaren |
| `app/` | Android-skalet (WebView + mikrofon + svensk talsyntes) |

## Kom igång

1. Installera `dist/app.apk` (tillåt "okända källor") eller öppna `web/index.html` i Chrome.
2. Tryck på kugghjulet och klistra in API-nyckeln. Den sparas bara på enheten –
   den finns **inte** i koden, eftersom repot är publikt.
3. Tryck **Starta** och tillåt mikrofonen. Skärmen hålls tänd medan appen lyssnar.

I inställningarna går det att byta modell, känslighet och inspelningslängd.
Tysta perioder skickas inte, och appen pausar inspelningen medan den själv piper.

Både Gemini API-nycklar (`AIza…`) och Vertex AI-nycklar (`AQ.…`) fungerar; appen
provar rätt tjänst automatiskt.

## Bygga själv

```sh
cd munkmora
./gradlew assembleRelease   # kräver Android SDK
```
