/* Real-time Spectrum / Animated Visualizer (Background-Safe) */
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
    this.useSimulated = false;
    this.simPhase = 0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      // On Android APK or mobile browsers, routing <audio> through AudioContext causes
      // Chromium to suspend audio in background/lock screen. Use simulated spectrum
      // to keep native <audio> playback completely uninhibited.
      const isAndroidAPK = !!(window.AndroidBridge);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isAndroidAPK || isMobile) {
        this.useSimulated = true;
        this.dataArray = new Uint8Array(32);
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64; // Smooth bars count
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.source = this.audioCtx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }

      this.audio.addEventListener('play', () => this.startLoop());
      this.audio.addEventListener('pause', () => this.stopLoop());
      this.audio.addEventListener('ended', () => this.stopLoop());

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopLoop();
        } else if (!this.audio.paused) {
          this.startLoop();
        }
      });

      this.isInitialized = true;
      if (!this.audio.paused && !document.hidden) this.startLoop();
    } catch (e) {
      console.warn('AudioVisualizer falling back to simulated spectrum:', e);
      this.useSimulated = true;
      this.dataArray = new Uint8Array(32);
      this.isInitialized = true;
      if (!this.audio.paused && !document.hidden) this.startLoop();
    }
  }

  startLoop() {
    if (this.animationFrame || document.hidden) return;
    this.draw();
  }

  stopLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.useSimulated) {
      this.audioCtx.resume().catch(() => {});
    }
    if (!this.audio.paused && !document.hidden) {
      this.startLoop();
    }
  }

  draw() {
    if (document.hidden || this.audio.paused) {
      this.stopLoop();
      return;
    }
    this.animationFrame = requestAnimationFrame(() => this.draw());

    const width = this.canvas.width = this.canvas.clientWidth || 90;
    const height = this.canvas.height = this.canvas.clientHeight || 30;

    this.ctx.clearRect(0, 0, width, height);

    if (this.useSimulated || !this.analyser) {
      // Smooth animated procedural spectrum bars
      this.simPhase += 0.15;
      const len = this.dataArray.length;
      for (let i = 0; i < len; i++) {
        const v1 = Math.sin(this.simPhase + i * 0.4);
        const v2 = Math.cos(this.simPhase * 0.7 + i * 0.2);
        const val = Math.abs(v1 + v2) / 2;
        this.dataArray[i] = Math.floor(val * 200 + 45);
      }
    } else {
      this.analyser.getByteFrequencyData(this.dataArray);
    }

    if (!this._gradientCache || this._gradientHeight !== height) {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--accent-primary').trim() || '#9893DA';
      const light = style.getPropertyValue('--accent-light').trim() || '#BBBDF6';
      this._gradientCache = this.ctx.createLinearGradient(0, height, 0, 0);
      this._gradientCache.addColorStop(0, primary);
      this._gradientCache.addColorStop(1, light);
      this._gradientHeight = height;
    }
    this.ctx.fillStyle = this._gradientCache;

    const bufferLength = this.dataArray.length;
    const barWidth = (width / bufferLength) * 1.6;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * height;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, Math.max(1, barWidth - 2), barHeight, [2, 2, 0, 0]);
      this.ctx.fill();
      x += barWidth;
    }
  }
}

window.AudioVisualizer = AudioVisualizer;

