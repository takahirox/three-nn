import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const scene = await readJSON('../src/shadow-scene.json');
const manifest = await readJSON('../src/shadow-models/manifest.json');
const expected = {
  'small-shallow': [[4, 16, 1], 97],
  'medium-shallow': [[4, 32, 1], 193],
  'small-deep': [[4, 16, 16, 1], 369],
  'baseline-deep': [[4, 32, 32, 1], 1249],
};
assert.equal(manifest.defaultModel, 'baseline-deep');
assert.equal(manifest.sceneVersion, scene.version);
assert.deepEqual(manifest.models.map(({ id }) => id), Object.keys(expected));
assert.equal(manifest.sharedData.trainingSamples, 98304);
assert.equal(manifest.sharedData.evaluationSamples, 3072);

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

function evaluate(model, [x, z, degrees]) {
  const norm = (v, [lo, hi]) => (2 * v - hi - lo) / (hi - lo);
  let values = [norm(x, model.normalization.x), norm(z, model.normalization.z),
    Math.sin(degrees * Math.PI / 180), Math.cos(degrees * Math.PI / 180)];
  for (const [index, layer] of model.layers.entries()) {
    values = layer.weights.map((row, i) => {
      const y = row.reduce((sum, w, j) => sum + w * values[j], layer.biases[i]);
      return index < model.layers.length - 1 ? Math.max(y, 0) : 1 / (1 + Math.exp(-y));
    });
  }
  return values[0];
}

test('ray teacher recognizes contacts, projected sphere shadow, outside and azimuth sign', () => {
  for (const [point, expected] of [
    [[-0.9, 0.5, 0], 0], [[0.95, 0.15, 0], 0], [[-0.9, -0.2, 0], 0],
    [[2.9, 2.9, 0], 1], [[2.9, -2.9, 40], 1], [[-1.6, -0.1, 40], 0], [[-1.6, -0.1, -40], 1],
  ]) assert.equal(visibility(...point), expected, JSON.stringify(point));
});

function compare(actual, recorded) {
  for (const key of ['samples', 'shadowed', 'lit']) assert.equal(actual[key], recorded[key]);
  assert.ok(Math.abs(actual.mae - recorded.mae) < 2e-5, 'MAE metadata drift');
  assert.ok(Math.abs(actual.iou - recorded.iou) < 1e-6, 'IoU metadata drift');
}

for (const entry of manifest.models) {
  const bytes = await readFile(new URL(`../src/shadow-models/${entry.artifact}`, import.meta.url));
  const model = JSON.parse(bytes);
  test(`${entry.id}: schema, tensor layout, artifact hash and Python/JS probes`, () => {
    assert.deepEqual(model.architecture, expected[entry.id][0]);
    assert.deepEqual(entry.architecture, model.architecture);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
    if (entry.id !== 'baseline-deep') {
      assert.equal(model.id, entry.id);
      assert.equal(model.parameterCount, entry.parameterCount);
    }
    assert.deepEqual(model.normalization.inputs,
      ['x mapped to [-1,1]', 'z mapped to [-1,1]', 'sin(azimuth)', 'cos(azimuth)']);
    assert.deepEqual(model.validationSet, {
      gridSide: 121, samplesPerClassPerAngle: 512, anglesDegrees: [-40, 0, 40],
      selection: 'cell centers; systematic class-stratified subsample',
    });
    assert.equal(model.training.seed, 73);
    assert.equal(model.training.uniformSamples, 65536);
    assert.equal(model.training.extraShadowSamples, 32768);
    assert.equal(model.training.steps, 10000);
    assert.equal(model.training.batchSize, 2048);
    assert.equal(model.training.optimizer, 'Adam');
    assert.equal(model.training.loss, 'BCE');
    assert.equal(model.sceneVersion, scene.version);
    assert.equal(model.activation, 'relu');
    assert.equal(model.outputActivation, 'sigmoid');
    assert.deepEqual(model.normalization.x, scene.ground.x);
    assert.deepEqual(model.normalization.z, scene.ground.z);
    assert.equal(model.layers.length, model.architecture.length - 1);
    let count = 0;
    model.layers.forEach((layer, index) => {
      assert.deepEqual(entry.tensors[index], {
        weights: [model.architecture[index + 1], model.architecture[index]],
        biases: [model.architecture[index + 1]],
      });
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
    assert.equal(count, expected[entry.id][1]);
    assert.equal(count, entry.parameterCount);
    for (const probe of model.probes) {
      assert.ok(Math.abs(evaluate(model, probe.point) - probe.visibility) < 2e-5);
    }
  });

  test(`${entry.id}: independently regenerated common held-out MAE/IoU`, () => {
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
          const prediction = evaluate(model, point);
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
      // Counts exact; float32 Python versus float64 JS tolerates 2e-5 MAE, 1e-6 IoU.
      compare(metrics(result), model.validation.angles[angle]);
    }
    const result = metrics(aggregate);
    console.log(`Aggregate: ${JSON.stringify(result)}`);
    assert.equal(result.samples, 3072);
    assert.equal(result.shadowed, 1536);
    assert.equal(result.lit, 1536);
    compare(result, model.validation.aggregate);
    assert.ok(aggregate.intersection > 0 && aggregate.union < 3072, 'non-degenerate predictions');
    if (entry.id === 'baseline-deep') assert.ok(result.iou >= 0.70);
  });
}
