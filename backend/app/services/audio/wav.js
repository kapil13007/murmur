// File: app/services/audio/wav.js
// WAV decoding/encoding and lightweight signal analysis. Clients upload 16 kHz
// mono 16-bit PCM WAV, but anything PCM/float WAV is accepted and normalised
// to the 16 kHz mono Float32 samples Whisper expects.
export const TARGET_SAMPLE_RATE = 16_000;

export class AudioFormatError extends Error {}

export function isWav(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

export function decodeWav(buffer) {
  if (!isWav(buffer)) throw new AudioFormatError('Audio must be a WAV file');

  let offset = 12;
  let fmt = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
      // WAVE_FORMAT_EXTENSIBLE: the real format code lives in the sub-format GUID.
      if (fmt.format === 0xfffe && size >= 26) fmt.format = buffer.readUInt16LE(body + 24);
    } else if (id === 'data') {
      if (!fmt) throw new AudioFormatError('WAV file has no format chunk');
      // Streaming encoders sometimes write 0 / 0xFFFFFFFF as the data size.
      const end = size === 0 || body + size > buffer.length ? buffer.length : body + size;
      return { ...fmt, samples: readSamples(buffer, body, end, fmt) };
    }
    offset = body + size + (size % 2);
  }
  throw new AudioFormatError('WAV file has no audio data');
}

function readSamples(buffer, start, end, { format, channels, bitsPerSample }) {
  const bytes = bitsPerSample / 8;
  const frameBytes = bytes * channels;
  const frames = Math.floor((end - start) / frameBytes);
  const out = new Float32Array(frames);

  let read;
  if (format === 1 && bitsPerSample === 16) read = (p) => buffer.readInt16LE(p) / 32768;
  else if (format === 1 && bitsPerSample === 8) read = (p) => (buffer.readUInt8(p) - 128) / 128;
  else if (format === 1 && bitsPerSample === 24) read = (p) => buffer.readIntLE(p, 3) / 8388608;
  else if (format === 1 && bitsPerSample === 32) read = (p) => buffer.readInt32LE(p) / 2147483648;
  else if (format === 3 && bitsPerSample === 32) read = (p) => buffer.readFloatLE(p);
  else throw new AudioFormatError(`Unsupported WAV encoding (format ${format}, ${bitsPerSample}-bit)`);

  for (let i = 0; i < frames; i++) {
    let sum = 0;
    const frameStart = start + i * frameBytes;
    for (let c = 0; c < channels; c++) sum += read(frameStart + c * bytes);
    out[i] = sum / channels; // mix down to mono
  }
  return out;
}

export function resample(samples, fromRate, toRate = TARGET_SAMPLE_RATE) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  if (Number.isInteger(ratio)) {
    // Box-filter decimation (e.g. 48k -> 16k): averaging suppresses aliasing.
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let j = 0; j < ratio; j++) sum += samples[i * ratio + j];
      out[i] = sum / ratio;
    }
    return out;
  }
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = samples[idx];
    const b = samples[Math.min(idx + 1, samples.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function encodeWav(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
  }
  return buffer;
}

// Energy-based voice activity estimate on 30 ms frames. Good enough to tell
// "the user said something" from "the mic recorded silence", which is what
// stops Whisper from hallucinating text on empty recordings.
export function analyzeAudio(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const frame = Math.max(1, Math.round(sampleRate * 0.03));
  const energies = [];
  let peak = 0;
  let total = 0;
  for (let i = 0; i < samples.length; i += frame) {
    let sum = 0;
    const end = Math.min(i + frame, samples.length);
    for (let j = i; j < end; j++) {
      const v = samples[j];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    total += sum;
    energies.push(Math.sqrt(sum / (end - i)));
  }
  const sorted = [...energies].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const threshold = Math.max(0.012, noiseFloor * 2.5);
  let speechFrames = 0;
  let firstSpeech = -1;
  let lastSpeech = -1;
  energies.forEach((e, i) => {
    if (e <= threshold) return;
    speechFrames++;
    if (firstSpeech < 0) firstSpeech = i;
    lastSpeech = i;
  });
  return {
    durationSeconds: samples.length / sampleRate,
    speechSeconds: (speechFrames * frame) / sampleRate,
    // First to last voiced frame: the talking time used for words-per-minute.
    speechSpanSeconds: firstSpeech < 0 ? 0 : ((lastSpeech - firstSpeech + 1) * frame) / sampleRate,
    rms: samples.length ? Math.sqrt(total / samples.length) : 0,
    peak,
    noiseFloor,
  };
}

export function hasSpeech(analysis) {
  return analysis.peak >= 0.02 && analysis.speechSeconds >= 0.15;
}

// Decode any supported upload into 16 kHz mono samples + a normalised WAV.
export function prepareAudio(buffer) {
  const decoded = decodeWav(buffer);
  const samples = resample(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE);
  const analysis = analyzeAudio(samples, TARGET_SAMPLE_RATE);
  const wav =
    decoded.sampleRate === TARGET_SAMPLE_RATE && decoded.channels === 1 && decoded.bitsPerSample === 16 && decoded.format === 1
      ? buffer
      : encodeWav(samples, TARGET_SAMPLE_RATE);
  return { samples, sampleRate: TARGET_SAMPLE_RATE, wav, analysis };
}
