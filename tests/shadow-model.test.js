import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const scene = await readJSON('../src/shadow-scene.json');
const model = await readJSON('../src/shadow-weights.json');

// Independent scalar JS slab/quadratic teacher: no Python labels/datasets loaded.
function visibility(x, z, degrees) {
  const angle = degrees * Math.PI / 180;
  const elevation = scene.light.elevationDegrees * Math.PI / 180;
  const ray = [Math.cos(elevation) * Math.sin(angle), Math.sin(elevation), Math.cos(elevation) * Math.cos(angle)];
  const origin = [x, scene.ground.y + scene.teacher.epsilon, z];
  const delta = origin.map((v, i) => v - scene.sphere.center[i]);
  const b = delta.reduce((v, d, i) => v + d * ray[i], 0);
  const c = delta.reduce((v, d) => v + d * d, 0) - scene.sphere.radius ** 2;
  if (b * b >= c && -b + Math.sqrt(b * b - c) > 0) return 0;
  let enter = -Infinity, exit = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const lo = scene.box.center[axis] - scene.box.size[axis] / 2;
    const hi = scene.box.center[axis] + scene.box.size[axis] / 2;
    if (Math.abs(ray[axis]) < 1e-12) {
      if (origin[axis] < lo || origin[axis] > hi) return 1;
    } else {
      const a = (lo - origin[axis]) / ray[axis];
      const b = (hi - origin[axis]) / ray[axis];
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
  }
  return exit >= Math.max(enter, 0) && exit > 0 ? 0 : 1;
}

function evaluate([x, z, degrees]) {
  const norm = (v, [lo, hi]) => (2 * v - hi - lo) / (hi - lo);
  let values = [norm(x, model.normalization.x), norm(z, model.normalization.z),
    Math.sin(degrees * Math.PI / 180), Math.cos(degrees * Math.PI / 180)];
  for (const [index, layer] of model.layers.entries()) {
    values = layer.weights.map((row, i) => {
      const y = row.reduce((sum, w, j) => sum + w * values[j], layer.biases[i]);
      return index < 2 ? Math.max(y, 0) : 1 / (1 + Math.exp(-y));
    });
  }
  return values[0];
}

test('shadow export schema, normalization, finite row-major parameters and Python/JS probes', () => {
  assert.deepEqual(model.architecture, [4, 32, 32, 1]);
  assert.equal(model.sceneVersion, scene.version);
  assert.equal(model.activation, 'relu');
  assert.equal(model.outputActivation, 'sigmoid');
  assert.deepEqual(model.normalization.x, scene.ground.x);
  assert.deepEqual(model.normalization.z, scene.ground.z);
  assert.equal(model.layers.length, 3);
  let count = 0;
  model.layers.forEach((layer, index) => {
    assert.equal(layer.weights.length, model.architecture[index + 1]);
    assert.equal(layer.biases.length, model.architecture[index + 1]);
    for (const row of layer.weights) {
      assert.equal(row.length, model.architecture[index]);
      assert.ok(row.every(Number.isFinite));
      count += row.length;
    }
    assert.ok(layer.biases.every(Number.isFinite));
    count += layer.biases.length;
  });
  assert.equal(count, 1249);
  for (const probe of model.probes) {
    assert.ok(Math.abs(evaluate(probe.point) - probe.visibility) < 2e-5);
  }
});

test('ray teacher recognizes contacts, projected sphere shadow, outside and azimuth sign', () => {
  for (const [point, expected] of [
    [[-0.9, 0.5, 0], 0], [[0.95, 0.15, 0], 0], [[-0.9, -0.2, 0], 0],
    [[2.9, 2.9, 0], 1], [[2.9, -2.9, 40], 1], [[-1.6, -0.1, 40], 0], [[-1.6, -0.1, -40], 1],
  ]) assert.equal(visibility(...point), expected, JSON.stringify(point));
});

test('independent held-out stratified ideal-ray visibility meets shadow IoU ≥ 0.70', () => {
  const aggregate = { samples: 0, shadowed: 0, lit: 0, error: 0, intersection: 0, union: 0 };
  const metrics = ({ samples, shadowed, lit, error, intersection, union }) =>
    ({ samples, shadowed, lit, mae: error / samples, iou: intersection / union });
  for (const angle of [-40, 0, 40]) {
    const groups = [[], []];
    for (let i = 0; i < 121; i++) for (let j = 0; j < 121; j++) {
      const x = scene.ground.x[0] + (i + 0.5) / 121 * (scene.ground.x[1] - scene.ground.x[0]);
      const z = scene.ground.z[0] + (j + 0.5) / 121 * (scene.ground.z[1] - scene.ground.z[0]);
      groups[visibility(x, z, angle)].push([x, z, angle]);
    }
    const result = { samples: 0, shadowed: 0, lit: 0, error: 0, intersection: 0, union: 0 };
    for (const label of [0, 1]) {
      assert.ok(groups[label].length >= 512);
      for (let k = 0; k < 512; k++) {
        const point = groups[label][Math.floor(k * groups[label].length / 512)];
        const prediction = evaluate(point);
        assert.ok(Number.isFinite(prediction) && prediction >= 0 && prediction <= 1);
        result.samples++;
        result[label === 0 ? 'shadowed' : 'lit']++;
        result.error += Math.abs(prediction - label);
        result.intersection += Number(label === 0 && prediction < 0.5);
        result.union += Number(label === 0 || prediction < 0.5);
      }
    }
    for (const key of Object.keys(result)) aggregate[key] += result[key];
    console.log(`${angle}°: ${JSON.stringify(metrics(result))}`);
    // Cross-language evaluation regenerates labels, not stored predictions.
    assert.ok(Math.abs(metrics(result).iou - model.validation.angles[angle].iou) < 1e-6);
  }
  const result = metrics(aggregate);
  console.log(`Aggregate: ${JSON.stringify(result)}`);
  assert.equal(result.samples, 3072);
  assert.equal(result.shadowed, 1536);
  assert.equal(result.lit, 1536);
  assert.ok(result.iou >= 0.70, `Shadow IoU ${result.iou} < 0.70`);
});
