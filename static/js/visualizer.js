/* Real-time Web Audio API Spectrum Visualizer */
class AudioVisualizer {
  constructor(audioElement, canvasElement) {
    this.audio = audioElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.isInitialized = false;
    this.animationFrame = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64; // Smooth bars count
      
      this.source = this.audioCtx.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      // Mobile browsers auto-suspend the AudioContext when the tab is
      // backgrounded to save power. Since the <audio> element's output is
      // routed entirely through this context, a suspended context means
      // total silence even though the element itself reports "playing".
      // Auto-resume the instant the browser suspends it while a track
      // should be audible.
      this.audioCtx.onstatechange = () => {
        if (this.audioCtx.state === 'suspended' && !this.audio.paused) {
          this.audioCtx.resume().catch(() => {});
        }
      };

      this.isInitialized = true;
      this.draw();
    } catch (e) {
      console.warn('AudioVisualizer init deferred until user playback gesture:', e);
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  draw() {
    this.animationFrame = requestAnimationFrame(() => this.draw());
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const width = this.canvas.width = this.canvas.clientWidth || 90;
    const height = this.canvas.height = this.canvas.clientHeight || 30;

    this.ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.6;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;

      // Dynamic Glassy Gradient using palette colors (#BBBDF6 & #9893DA)
      const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#797A9E');
      gradient.addColorStop(0.5, '#9893DA');
      gradient.addColorStop(1, '#BBBDF6');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
      this.ctx.fill();

      x += barWidth;
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
