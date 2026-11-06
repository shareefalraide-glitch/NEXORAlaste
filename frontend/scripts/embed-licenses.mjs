// Keep the standalone HTML redistributable when it is shared without the source archive.
import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../dist/index.html', import.meta.url);
const notices = await readFile(new URL('../THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8');
const escaped = notices.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const html = await readFile(path, 'utf8');
if (!html.includes('</body>'))
  throw new Error('Unable to embed license notices: missing body element');
await writeFile(
  path,
  html.replace('</body>', `<template id="third-party-licenses">${escaped}</template>\n</body>`),
);
console.log('Embedded third-party license notices in standalone HTML.');
