// Audio-thread level meter for the live interview (src/features/roles/live-call/level-meter.ts).
// Posts one dBFS level per frame of `processorOptions.frameSamples` samples. Served from the app
// origin so the Content-Security-Policy's script-src 'self' covers audioWorklet.addModule().
registerProcessor("pp-level-meter", class extends AudioWorkletProcessor {
  constructor(options) { super(); this.size = options.processorOptions.frameSamples; this.sum = 0; this.n = 0 }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i] * channel[i]
      if (++this.n === this.size) { this.port.postMessage(10 * Math.log10(this.sum / this.n)); this.sum = 0; this.n = 0 }
    }
    return true
  }
})
