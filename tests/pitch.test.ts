import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

type Processor = {
  process: (
    input: Float32Array[][],
    output: Float32Array[][],
    params: { semitones: Float32Array }
  ) => boolean;
};
function generate(semitones: number) {
  let ProcessorClass: new () => Processor;
  const sampleRate = 48000;
  const sandbox = {
    AudioWorkletProcessor: class {},
    sampleRate,
    registerProcessor: (_name: string, constructor: new () => Processor) =>
      (ProcessorClass = constructor)
  };
  vm.runInNewContext(readFileSync('static/audio/pitch-processor.js', 'utf8'), sandbox);
  const processor = new ProcessorClass!();
  const result: number[] = [];
  for (let offset = 0; offset < sampleRate * 2; offset += 128) {
    const input = Float32Array.from(
      { length: 128 },
      (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * (offset + i)) / sampleRate)
    );
    const output = new Float32Array(128);
    expect(
      processor.process([[input]], [[output]], { semitones: new Float32Array([semitones]) })
    ).toBe(true);
    if (offset >= sampleRate) result.push(...output);
  }
  return { samples: result, sampleRate };
}
describe('outgoing audio pitch processor', () => {
  for (const semitones of [-6, 0, 6]) {
    it(`shifts a 220 Hz signal by ${semitones} semitones without changing duration`, () => {
      const { samples, sampleRate } = generate(semitones);
      // Autocorrelation estimates the fundamental despite the crossfaded grains.
      const expected = 220 * 2 ** (semitones / 12);
      let bestLag = 0,
        bestCorrelation = -Infinity;
      for (
        let lag = Math.floor(sampleRate / (expected * 1.15));
        lag <= Math.ceil(sampleRate / (expected * 0.85));
        lag++
      ) {
        let correlation = 0;
        for (let i = 0; i < 10000; i++) correlation += samples[i] * samples[i + lag];
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
      expect(Math.abs(sampleRate / bestLag - expected)).toBeLessThan(6);
      expect(samples.every(Number.isFinite)).toBe(true);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.501);
      expect(samples.length).toBeGreaterThanOrEqual(sampleRate - 128);
    });
  }
});
