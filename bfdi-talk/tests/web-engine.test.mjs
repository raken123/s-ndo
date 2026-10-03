import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitReply, toJsonSchema } from '../www/js/web-engine.js';

const EMO = ['happy', 'sad', 'excited', 'angry'];

test('splitReply: emotion tags and whole sentences', () => {
  const { pieces } = splitReply('<happy> Hi there! I love BFDI. <sad> But Leafy left…', EMO, true);
  assert.deepEqual(pieces, [
    { text: 'Hi there!', emotion: 'happy' },
    { text: 'I love BFDI.', emotion: 'happy' },
    { text: 'But Leafy left…', emotion: 'sad' },
  ]);
});

test('splitReply: streaming keeps unfinished sentences and tags for later', () => {
  const full = '<excited> Wow! That is so cool <an';
  const a = splitReply(full, EMO, false);
  assert.deepEqual(a.pieces, [{ text: 'Wow!', emotion: 'excited' }]);
  const rest = full.slice(a.consumed) + 'gry> and annoying.';
  const b = splitReply(rest, EMO, true, a.emotion);
  assert.deepEqual(b.pieces, [{ text: 'That is so cool', emotion: 'excited' }, { text: 'and annoying.', emotion: 'angry' }]);
});

test('splitReply: same text either streamed in bits or all at once', () => {
  const full = '<happy> One. Two! <sad> Three? Four.';
  const once = splitReply(full, EMO, true).pieces;
  let said = 0, emotion = 'happy';
  const got = [];
  for (let i = 1; i <= full.length; i++) {
    const r = splitReply(full.slice(said, i), EMO, i === full.length, emotion);
    said += r.consumed; emotion = r.emotion; got.push(...r.pieces);
  }
  assert.deepEqual(got, once);
});

test('splitReply: unknown tags are dropped, text without tags is happy', () => {
  assert.deepEqual(splitReply('<wink> Hello friend', EMO, true).pieces, [{ text: 'Hello friend', emotion: 'happy' }]);
});

test('toJsonSchema lowercases Gemini types', () => {
  assert.deepEqual(toJsonSchema({ type: 'OBJECT', properties: { a: { type: 'STRING', enum: ['x'] } }, propertyOrdering: ['a'] }),
    { type: 'object', properties: { a: { type: 'string', enum: ['x'] } } });
});
