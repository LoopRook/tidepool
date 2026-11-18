import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundle } from '../build.js';

// index.html is the live page (GitHub Pages serves main), so a push with a stale
// bundle would ship old code. This catches a forgotten `node build.js`.
test('index.html and dist/tidepool.html are the current build of src/', () => {
  const lf = (s) => s.replace(/\r\n/g, '\n');
  const { html } = bundle();
  assert.ok(lf(readFileSync('index.html', 'utf8')) === lf(html), 'index.html is stale: run node build.js');
  assert.ok(lf(readFileSync('dist/tidepool.html', 'utf8')) === lf(html), 'dist/tidepool.html is stale: run node build.js');
});
