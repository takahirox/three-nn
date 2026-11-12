import { Fn, clamp, dot, exp, float, max, vec4 } from 'three/tsl';
import model from './shadow-weights.json';

// Each row is one output neuron: weights[output][input], then biases[output].
// JS constructs this graph once. All inputs and arithmetic run per fragment.
export const neuralVisibility = Fn(([ground, azimuth]) => {
  const { x, z } = model.normalization;
  let values = [ground.x.sub((x[0] + x[1]) / 2).div((x[1] - x[0]) / 2),
    ground.z.sub((z[0] + z[1]) / 2).div((z[1] - z[0]) / 2),
    azimuth.sin(), azimuth.cos()];
  for (const [index, layer] of model.layers.entries()) {
    values = layer.weights.map((row, neuron) => {
      let sum = float(layer.biases[neuron]);
      for (let i = 0; i < row.length; i += 4) {
        sum = sum.add(dot(vec4(...values.slice(i, i + 4)), vec4(...row.slice(i, i + 4))));
      }
      return (index < 2 ? max(sum, 0) : float(1).div(float(1).add(exp(sum.negate())))).toVar();
    });
  }
  return clamp(values[0], 0, 1);
});
