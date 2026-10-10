import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../js/ui.js';

test('fmt shows small amounts in full and large ones with a suffix', () => {
  assert.equal(fmt(0), '$0');
  assert.equal(fmt(1234), '$1,234');
  assert.equal(fmt(15_300), '$15.3K');
  assert.equal(fmt(2_500_000), '$2.5M');
  assert.equal(fmt(500_000_000), '$500M');
  assert.equal(fmt(3_000_000_000), '$3B');
});
