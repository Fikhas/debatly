/* Real-time, two-head granular delay shifter. Pitch changes without changing call speed. */
class PitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'semitones', defaultValue: 0, minValue: -6, maxValue: 6, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.buffer = new Float32Array(32768);
    this.write = 0;
    this.phase = 0;
    this.ratio = 1;
  }
  read(position) {
    const size = this.buffer.length;
    const wrapped = ((position % size) + size) % size;
    const base = Math.floor(wrapped);
    const frac = wrapped - base;
    return this.buffer[base] * (1 - frac) + this.buffer[(base + 1) % size] * frac;
  }
  process(inputs, outputs, params) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    const target = Math.pow(2, params.semitones[0] / 12);
    const window = sampleRate * 0.055;
    for (let i = 0; i < output.length; i++) {
      const value = input?.[i] ?? 0;
      this.buffer[this.write] = value;
      this.ratio += (target - this.ratio) * 0.002;
      if (Math.abs(this.ratio - 1) < 0.001 && target === 1) {
        output[i] = value;
      } else {
        this.phase = (this.phase + Math.abs(1 - this.ratio) / window) % 1;
        const phase2 = (this.phase + 0.5) % 1;
        const delay1 = this.ratio >= 1 ? (1 - this.phase) * window : this.phase * window;
        const delay2 = this.ratio >= 1 ? (1 - phase2) * window : phase2 * window;
        const weight = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
        output[i] = this.read(this.write - delay1 - 2) * weight + this.read(this.write - delay2 - 2) * (1 - weight);
      }
      this.write = (this.write + 1) % this.buffer.length;
    }
    return true;
  }
}
registerProcessor('callbate-pitch', PitchProcessor);
