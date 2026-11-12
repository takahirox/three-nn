import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const weights = JSON.parse(await readFile(new URL('../src/weights.json', import.meta.url), 'utf8'));

test('export matches the scalar 1 → 8 → 1 ReLU contract', () => {
  assert.deepEqual(weights.architecture, [1, 8, 1]);
  assert.equal(weights.activation, 'relu');
  assert.equal(weights.outputActivation, 'linear');
  assert.equal(weights.target, 'x^4');
  for (const key of ['inputDomain', 'targetDomain', 'displayClamp']) {
    assert.deepEqual(weights[key], [0, 1]);
  }
  for (const key of ['w1', 'b1', 'w2']) {
    assert.ok(Array.isArray(weights[key]));
    assert.equal(weights[key].length, 8);
  }
  const parameters = [...weights.w1, ...weights.b1, ...weights.w2, weights.b2];
  assert.equal(parameters.length, 25);
  assert.ok(parameters.every((value) => typeof value === 'number' && Number.isFinite(value)));
});

test('unclamped model meets the 101-point accuracy requirements', () => {
  const errors = Array.from({ length: 101 }, (_, i) => {
    const x = i / 100;
    const y = weights.w2.reduce((sum, w2, j) =>
      sum + w2 * Math.max(weights.w1[j] * x + weights.b1[j], 0), weights.b2);
    return Math.abs(y - x ** 4);
  });
  const mae = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  const maximum = Math.max(...errors);
  console.log(`101-point unclamped MAE=${mae.toFixed(8)}, max absolute error=${maximum.toFixed(8)}`);
  assert.ok(mae <= 0.03, `MAE ${mae} exceeds 0.03`);
  assert.ok(maximum <= 0.10, `Maximum absolute error ${maximum} exceeds 0.10`);
});
