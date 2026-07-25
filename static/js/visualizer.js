/* Real-time Web Audio API Spectrum Visualizer */
class AudioVisualizer {
  constructor(audioElement, canvasElement) {
    this.audio = audioElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.isInitialized = false;
    this.animationFrame = null;
    this._gradientCache = null;
    this._gradientHeight = 0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64; // Smooth bars count
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

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

      // Only run the (60fps, canvas-redrawing) render loop while a track is
      // actually playing. Previously this ran forever, even while paused or
      // idle, burning CPU/GPU for nothing.
      this.audio.addEventListener('play', () => this.startLoop());
      this.audio.addEventListener('pause', () => this.stopLoop());
      this.audio.addEventListener('ended', () => this.stopLoop());

      this.isInitialized = true;
      if (!this.audio.paused) this.startLoop();
    } catch (e) {
      console.warn('AudioVisualizer init deferred until user playback gesture:', e);
    }
  }

  startLoop() {
    if (this.animationFrame) return; // already running
    this.draw();
  }

  stopLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    // Clear so the bars don't stay frozen mid-animation while paused
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

    this.analyser.getByteFrequencyData(this.dataArray);

    const width = this.canvas.width = this.canvas.clientWidth || 90;
    const height = this.canvas.height = this.canvas.clientHeight || 30;

    this.ctx.clearRect(0, 0, width, height);

    // Gradient only depends on canvas height, not the per-bar loop, so
    // rebuild it only when height actually changes instead of 32x/frame.
    if (!this._gradientCache || this._gradientHeight !== height) {
      this._gradientCache = this.ctx.createLinearGradient(0, height, 0, 0);
      this._gradientCache.addColorStop(0, '#797A9E');
      this._gradientCache.addColorStop(0.5, '#9893DA');
      this._gradientCache.addColorStop(1, '#BBBDF6');
      this._gradientHeight = height;
    }
    this.ctx.fillStyle = this._gradientCache;

    const bufferLength = this.dataArray.length;
    const barWidth = (width / bufferLength) * 1.6;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * height;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
      this.ctx.fill();
      x += barWidth;
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
