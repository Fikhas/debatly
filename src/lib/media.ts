export class VoiceEngine {
  context: AudioContext | null = null;
  raw: MediaStream | null = null;
  output: MediaStream | null = null;
  camera: MediaStream | null = null;
  private pitch: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private monitor: GainNode | null = null;
  muted = false;
  private closed = false;

  async start() {
    this.closed = false;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode)
      throw new Error(
        'Browser ini belum mendukung audio yang diperlukan. Gunakan Chrome, Edge, atau Safari terbaru melalui HTTPS.'
      );
    try {
      this.raw = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      if (this.closed) {
        this.raw.getTracks().forEach((t) => t.stop());
        throw new Error('Permintaan mikrofon dibatalkan.');
      }
      this.context = new AudioContext();
      await this.context.audioWorklet.addModule('/audio/pitch-processor.js');
      if (this.closed) throw new Error('Audio dibatalkan.');
      this.pitch = new AudioWorkletNode(this.context, 'callbate-pitch', {
        outputChannelCount: [1]
      });
      this.source = this.context.createMediaStreamSource(this.raw);
      const destination = this.context.createMediaStreamDestination();
      this.source.connect(this.pitch).connect(destination);
      this.monitor = this.context.createGain();
      this.monitor.gain.value = 0;
      this.pitch.connect(this.monitor).connect(this.context.destination);
      await this.context.resume();
      if (this.closed) {
        destination.stream.getTracks().forEach((track) => track.stop());
        throw new Error('Audio dibatalkan.');
      }
      this.output = destination.stream;
      return this.output;
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  setPitch(value: number) {
    if (!this.context || !this.pitch) return;
    this.pitch?.parameters
      .get('semitones')
      ?.setTargetAtTime(Math.max(-6, Math.min(6, value)), this.context!.currentTime, 0.03);
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.raw?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.output?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }
  listen(enabled: boolean) {
    if (this.monitor && this.context)
      this.monitor.gain.setTargetAtTime(enabled ? 0.7 : 0, this.context.currentTime, 0.03);
  }
  async enableCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    if (this.closed) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Kamera dibatalkan.');
    }
    this.camera = stream;
    return stream;
  }
  disableCamera() {
    this.camera?.getTracks().forEach((t) => t.stop());
    this.camera = null;
  }
  stop() {
    this.closed = true;
    this.disableCamera();
    this.raw?.getTracks().forEach((t) => t.stop());
    this.output?.getTracks().forEach((t) => t.stop());
    this.source?.disconnect();
    this.pitch?.disconnect();
    this.monitor?.disconnect();
    if (this.context?.state !== 'closed') void this.context?.close();
    this.raw = null;
    this.output = null;
    this.context = null;
    this.source = null;
    this.pitch = null;
    this.monitor = null;
  }
}
