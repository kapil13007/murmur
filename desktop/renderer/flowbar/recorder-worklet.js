/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// File: desktop/renderer/flowbar/recorder-worklet.js (same as frontend/public/recorder-worklet.js)
// AudioWorklet that forwards raw microphone samples to the main thread in
// ~100 ms batches. The AudioContext runs at 16 kHz, so the browser resamples
// the microphone for us and the samples can go straight into a WAV file.
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.length = 0;
    this.batch = Math.round(sampleRate / 10);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.buffer.push(new Float32Array(channel));
      this.length += channel.length;
      if (this.length >= this.batch) {
        const out = new Float32Array(this.length);
        let offset = 0;
        for (const chunk of this.buffer) {
          out.set(chunk, offset);
          offset += chunk.length;
        }
        this.port.postMessage(out, [out.buffer]);
        this.buffer = [];
        this.length = 0;
      }
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
