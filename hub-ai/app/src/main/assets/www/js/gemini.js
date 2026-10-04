/* Hub generation with Gemini through the Gemini API (generateContent).
 * The user brings their own API key (Settings). Model ids are editable in
 * Settings too, in case Google names them differently.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var DEFAULT_MODELS = { flash: 'gemini-3.8-flash', gpro: 'gemini-3.8-pro' };

  var SYSTEM = [
    'You build "hubs": small single-page apps delivered as ONE self-contained HTML file.',
    'Rules:',
    '- Reply with the HTML document only, starting with <!doctype html>. No explanations, no Markdown fences.',
    '- Inline all CSS and JavaScript. No external scripts, fonts, images or network requests.',
    '- It must work offline on a phone: responsive layout, touch friendly, viewport meta tag.',
    '- Use a calm dark theme (near-black background, light text, one accent colour) unless asked otherwise.',
    '- Wrap any localStorage use in try/catch; it may be unavailable.',
    '- Give the document a short <title>.'
  ].join('\n');

  function settings() {
    var s = Store.get('settings', {});
    return {
      key: s.geminiKey || '',
      models: { flash: s.flashModel || DEFAULT_MODELS.flash, gpro: s.proModel || DEFAULT_MODELS.gpro }
    };
  }

  function cleanHtml(text) {
    var t = String(text || '').trim();
    var fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    var start = t.search(/<!doctype html|<html/i);
    if (start > 0) t = t.slice(start);
    if (!/<html|<body|<!doctype/i.test(t)) throw new Error('Gemini did not return an HTML document.');
    return t;
  }

  function titleOf(html, fallback) {
    var m = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
    return m ? m[1].trim() : fallback;
  }

  function generate(engineId, prompt) {
    var s = settings();
    if (!s.key) return Promise.reject(new Error('Add your Gemini API key in Settings to use Gemini.'));
    var model = s.models[engineId];
    var body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 32768 }
    });
    return HubBridge.request('POST', ENDPOINT + encodeURIComponent(model) + ':generateContent',
      { 'Content-Type': 'application/json', 'x-goog-api-key': s.key }, body)
      .then(function (r) {
        var data = null;
        try { data = JSON.parse(r.body); } catch (e) { /* not JSON */ }
        if (r.status !== 200) {
          var msg = data && data.error && data.error.message ? data.error.message : (r.body || 'no response').slice(0, 200);
          if (r.status === 0) msg = 'Network error: ' + msg;
          if (r.status === 404) msg += ' (check the model id "' + model + '" in Settings)';
          throw new Error('Gemini: ' + msg);
        }
        var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        if (!parts) {
          var why = data && data.promptFeedback && data.promptFeedback.blockReason;
          throw new Error(why ? 'Gemini blocked this request (' + why + ').' : 'Gemini returned an empty answer.');
        }
        var html = cleanHtml(parts.map(function (p) { return p.text || ''; }).join(''));
        return { html: html, title: titleOf(html, prompt.slice(0, 40)), notes: [] };
      });
  }

  window.Gemini = { generate: generate, settings: settings, DEFAULT_MODELS: DEFAULT_MODELS, cleanHtml: cleanHtml };
})();
