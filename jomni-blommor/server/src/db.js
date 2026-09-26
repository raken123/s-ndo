import fs from 'node:fs';
import path from 'node:path';

function normalize(d = {}) {
  return {
    users: [],
    sessions: {},
    orders: [],
    discounts: [],
    stars: { received: 0, spent: 0, ratings: 0 },
    devices: [],
    counters: { order: 1000 },
    ...d,
  };
}

// Enkel JSON-fil som databas. Skrivs atomiskt (tmp + rename) efter varje ändring.
// `file = null` ger en databas som bara lever i minnet (används i tester).
export function createDb(file) {
  let data;
  if (file) {
    try {
      data = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      data = normalize();
    }
  } else {
    data = normalize();
  }

  return {
    get data() { return data; },
    save() {
      if (!file) return;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
      fs.renameSync(tmp, file);
    },
  };
}
