/* FunHub: a scrolling feed of hubs. Starter posts are built from the hub
 * templates; hubs you publish are added on top. The feed lives on this
 * device (it isn't shared through Hub AI Cloud yet), and sharing goes
 * through the system share sheet as an .html file.
 */
(function () {
  'use strict';

  var SEEDS = [
    { id: 'seed-snake', type: 'snake', title: 'Snake', author: 'Hub AI', accent: '#2f9e5b', likes: 128 },
    { id: 'seed-memory', type: 'memory', title: 'Emoji Memory', author: 'Hub AI', accent: '#7d55c7', likes: 96 },
    { id: 'seed-breathing', type: 'breathing', title: 'Box Breathing', author: 'Hub AI', accent: '#1f9c94', likes: 74 },
    { id: 'seed-quiz', type: 'quiz', title: 'Space Quiz', author: 'Hub AI', accent: '#3b74d9', likes: 61, topic: 'space' },
    { id: 'seed-clicker', type: 'clicker', title: 'Star Clicker', author: 'Hub AI', accent: '#c9a227', likes: 58 },
    { id: 'seed-dice', type: 'dice', title: 'D20 Roller', author: 'Hub AI', accent: '#d94848', likes: 40, n: 20 },
    { id: 'seed-pomodoro', type: 'pomodoro', title: 'Focus 25', author: 'Hub AI', accent: '#e07b2a', likes: 37 },
    { id: 'seed-drawing', type: 'drawing', title: 'Doodle Pad', author: 'Hub AI', accent: '#d2558f', likes: 33 }
  ];

  var built = {};
  function seedHtml(s) {
    if (!built[s.id]) {
      built[s.id] = HubTemplates.render(s.type, {
        title: s.title, accent: s.accent, dark: true, persist: true, extras: true,
        n: s.n || null, topic: s.topic || '', key: s.id, engine: 'Hub V1 Max'
      });
    }
    return built[s.id];
  }

  function posts() {
    var mine = Store.get('funhub.posts', []);
    var seeds = SEEDS.map(function (s) {
      return { id: s.id, title: s.title, author: s.author, engine: 'Hub V1 Max', likes: s.likes, seed: true, html: null, _seed: s };
    });
    return mine.concat(seeds);
  }

  function html(post) { return post.seed ? seedHtml(post._seed) : post.html; }

  function liked(id) { return !!Store.get('funhub.likes', {})[id]; }
  function toggleLike(id) {
    var l = Store.get('funhub.likes', {});
    if (l[id]) delete l[id]; else l[id] = 1;
    Store.set('funhub.likes', l);
    return !!l[id];
  }

  function publish(hub, author) {
    var list = Store.get('funhub.posts', []).filter(function (p) { return p.hubId !== hub.id; });
    list.unshift({
      id: 'post-' + Date.now().toString(36), hubId: hub.id, title: hub.title, author: author || 'You',
      engine: hub.engineName, likes: 0, html: hub.html, created: Date.now()
    });
    return Store.set('funhub.posts', list);
  }

  function unpublish(hubId) {
    Store.set('funhub.posts', Store.get('funhub.posts', []).filter(function (p) { return p.hubId !== hubId; }));
  }

  function isPublished(hubId) {
    return Store.get('funhub.posts', []).some(function (p) { return p.hubId === hubId; });
  }

  window.FunHub = { posts: posts, html: html, liked: liked, toggleLike: toggleLike, publish: publish, unpublish: unpublish, isPublished: isPublished };
})();
