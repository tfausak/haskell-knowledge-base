const crypto = require('crypto');
const fs = require('fs/promises');
const https = require('https');
const path = require('path');
const process = require('process');

const OBSIDIAN_SITE = process.env.OBSIDIAN_SITE || 'unknown-obsidian-site';
const OBSIDIAN_TOKEN = process.env.OBSIDIAN_TOKEN || 'unknown-obsidian-token';

const LOCAL = new Set();
const REMOTE = new Set();

const handleEntries = (entries, cb) =>
  Promise.all(entries.map((entry) => handleEntry(entry, cb)));

const handleEntry = (entry, cb) =>
  fs.lstat(entry).then((stats) =>
    stats.isDirectory() ? handleDirectory(entry, cb) : cb(entry));

const handleDirectory = (directory, cb) =>
  fs.readdir(directory).then((entries) =>
    handleEntries(entries.map((entry) => path.join(directory, entry)), cb));

const httpRequest = (url, options, body) =>
  new Promise((resolve, _reject) => {
    const request = https.request(url, options, (response) => {
      let buffer = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        buffer += chunk;
      });
      response.on('end', () => resolve(buffer));
    });
    request.write(body);
    request.end();
  });

httpRequest(
  'https://publish-01.obsidian.md/api/list',
  {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  },
  JSON.stringify({
    id: OBSIDIAN_SITE,
    token: OBSIDIAN_TOKEN,
  })
)
  .then((body) => {
    const object = {};
    JSON.parse(body).forEach((element) => {
      const key = path.normalize(element.path);
      REMOTE.add(key);
      object[key] = element.hash;
    });
    return object;
  })
  .then((object) => handleDirectory('.', (file) => {
    LOCAL.add(file);
    if (file.match(/^[.](git|obsidian)/)) {
      return;
    }
    fs.readFile(file).then((buffer) => {
      const expected = object[file];
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      const actual = hash.digest('hex');
      if (!expected || actual !== expected) {
        console.log(`Uploading ${file} ...`);
        return httpRequest(
          'https://publish-01.obsidian.md/api/upload',
          {
            headers: {
              'Content-Type': 'application/octet-stream',
              'obs-hash': actual,
              'obs-id': OBSIDIAN_SITE,
              'obs-path': file,
              'obs-token': OBSIDIAN_TOKEN,
            },
            method: 'POST',
          },
          buffer
        );
      }
    });
  }))
  .then(() => {
    const toRemove = new Set(REMOTE);
    for (let seen of LOCAL) {
      toRemove.delete(seen);
    }
    return Promise.all(Array.from(toRemove).map((stale) => httpRequest(
      'https://publish-01.obsidian.md/api/remove ',
      {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
      JSON.stringify({
        id: OBSIDIAN_SITE,
        path: stale,
        token: OBSIDIAN_TOKEN,
      })
    )));
  })
  .catch((error) => console.error(error));
