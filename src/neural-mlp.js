import { Fn, float, max } from 'three/tsl';
import weights from './weights.json';

// This JS loop builds a TSL expression once; all arithmetic runs per fragment.
// Hidden unit i uses w1[i], b1[i], and w2[i]. The output has no activation.
export const neuralIntensity = Fn(([x]) => {
  let y = float(weights.b2);
  for (let i = 0; i < 8; i++) {
    const hidden = max(x.mul(weights.w1[i]).add(weights.b1[i]), 0);
    y = y.add(hidden.mul(weights.w2[i]));
  }
  return y;
});
