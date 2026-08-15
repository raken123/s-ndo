/* Thin Gemini client. The key travels in the x-goog-api-key header rather than
 * the query string so it stays out of URLs, proxy logs and referrers. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';
  var Store = AGENTER.Store;

  function endpoint(model) {
    return AGENTER.CONFIG.endpoint + encodeURIComponent(model) + ':generateContent';
  }

  var Gemini = {
    configured: function () { return Store.hasKey(); },

    /* history: [{role:'user'|'model', text}]   →   resolves to a string. */
    generate: function (system, history, signal) {
      var key = Store.apiKey();
      if (!key) return Promise.reject(new Error('NO_KEY'));

      var body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map(function (t) {
          return { role: t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] };
        }),
        generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 4096 }
      };

      return fetch(endpoint(Store.model()), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: signal
      }).then(function (res) {
        return res.text().then(function (raw) {
          var data = null;
          try { data = JSON.parse(raw); } catch (e) { /* non-JSON error body */ }

          if (!res.ok) {
            var msg = (data && data.error && data.error.message) || raw.slice(0, 300) ||
                      ('HTTP ' + res.status);
            if (res.status === 400 && /API key not valid/i.test(msg)) {
              throw new Error('That API key was rejected. Check it in Settings.');
            }
            if (res.status === 403) {
              throw new Error('The API key is not authorised for this model (HTTP 403). ' + msg);
            }
            if (res.status === 404) {
              throw new Error('No model named "' + Store.model() +
                              '". Pick another one in Settings.');
            }
            if (res.status === 429) {
              throw new Error('Google is rate-limiting this key right now (HTTP 429). Try again shortly.');
            }
            throw new Error(msg);
          }

          var cand = data && data.candidates && data.candidates[0];
          if (!cand) {
            var blocked = data && data.promptFeedback && data.promptFeedback.blockReason;
            throw new Error(blocked ? ('The prompt was blocked: ' + blocked)
                                    : 'The model returned nothing.');
          }
          var parts = (cand.content && cand.content.parts) || [];
          var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
          if (!text && cand.finishReason === 'MAX_TOKENS') {
            throw new Error('The reply hit the token ceiling before any text came back.');
          }
          if (!text) throw new Error('The model returned an empty reply.');
          return text;
        });
      });
    }
  };

  AGENTER.Gemini = Gemini;
})();
