#!/usr/bin/env node
'use strict';
// gmfy hub server entry point. Zero dependencies: `node server/index.js`.
const path = require('path');
const { Hub, VERSION } = require('./lib/hub');

function start(opts = {}) {
  const port = Number(opts.port != null ? opts.port : (process.env.PORT || 8787));
  const host = opts.host || process.env.HOST || '0.0.0.0';
  const dataFile = opts.dataFile !== undefined ? opts.dataFile : (process.env.HUB_DATA || path.join(__dirname, 'data', 'hub.json'));
  const clientDir = opts.clientDir !== undefined ? opts.clientDir : (process.env.HUB_CLIENT || path.join(__dirname, '..', 'client'));
  const hub = new Hub({ dataFile, clientDir, payments: opts.payments, log: opts.log });
  return hub.listen(port, host).then((p) => {
    const urls = ['http://localhost:' + p].concat(host === '0.0.0.0' || host === '::' ? hub.addresses(p) : []);
    if (!opts.quiet) {
      console.log('gmfy hub ' + VERSION + ' listening on port ' + p);
      for (const u of urls) console.log('  ' + u);
      console.log('  data: ' + (dataFile || '(memory only)'));
    }
    return { hub, port: p, urls, close: () => hub.close() };
  });
}

if (require.main === module) {
  start().then(({ hub }) => {
    const stop = () => { hub.close().then(() => process.exit(0)); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { start };
