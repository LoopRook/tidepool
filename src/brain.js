// Tiny feed-forward brain: inputs -> tanh hidden layer -> 3 outputs.
// Weight layout (flat array, so genomes stay JSON-friendly):
//   [0, H*I)            input->hidden, hidden j uses w[j*I + i] (the `bias` input is the hidden bias)
//   [H*I, H*I + O*(H+1)) hidden->output, output o uses w[H*I + o*(H+1) + j], j = H is its bias
import { dtanh } from './dmath.js';

export const INPUTS = [
  'foodAngle', 'foodDist',
  'preyAngle', 'preyDist',
  'threatAngle', 'threatDist',
  'kinAngle', 'kinDist',
  'energy', 'wall', 'clock', 'bias',
];
export const OUTPUTS = ['turn', 'thrust', 'bite'];
export const HIDDEN = 8;

const NI = INPUTS.length;
const NO = OUTPUTS.length;
const OUT_BASE = HIDDEN * NI;

export function weightCount() {
  return HIDDEN * NI + NO * (HIDDEN + 1);
}

// Index helpers so genome.js can build a behavioural prior without knowing the layout.
export function hiddenWeightIndex(hidden, input) {
  return hidden * NI + input;
}

export function outputWeightIndex(output, hidden) {
  // hidden === HIDDEN addresses the output's bias
  return OUT_BASE + output * (HIDDEN + 1) + hidden;
}

export function makeBrain(weights) {
  const w = Float64Array.from(weights);
  const h = new Float64Array(HIDDEN);
  const out = [0, 0, 0];
  return {
    // Returns the same array every call (no per-call allocation); copy if you keep it.
    think(inputs) {
      for (let j = 0; j < HIDDEN; j++) {
        let s = 0;
        const base = j * NI;
        for (let i = 0; i < NI; i++) s += w[base + i] * inputs[i];
        h[j] = dtanh(s);
      }
      for (let o = 0; o < NO; o++) {
        const base = OUT_BASE + o * (HIDDEN + 1);
        let s = w[base + HIDDEN];
        for (let j = 0; j < HIDDEN; j++) s += w[base + j] * h[j];
        // turn is signed; thrust and bite are squashed into [0, 1]
        out[o] = o === 0 ? dtanh(s) : 0.5 + 0.5 * dtanh(s);
      }
      return out;
    },
  };
}
