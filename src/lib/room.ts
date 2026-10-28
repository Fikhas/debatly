import { supabase, ensureParticipant } from './supabase.ts';
import { VoiceEngine } from './media.ts';
import type { Match, RoomMessage, Side } from './types.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RoomStatus =
  'idle' | 'permission' | 'searching' | 'connecting' | 'connected' | 'ended' | 'error';
export type RoomState = {
  status: RoomStatus;
  error: string;
  messages: RoomMessage[];
  remote: MediaStream | null;
  local: MediaStream | null;
  match: Match | null;
  userId: string;
  relay: boolean;
};

export class DebateRoom {
  voice = new VoiceEngine();
  state: RoomState = {
    status: 'idle',
    error: '',
    messages: [],
    remote: null,
    local: null,
    match: null,
    userId: '',
    relay: false
  };
  private pc: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private processing: Promise<void> = Promise.resolve();
  private seen = new Set<number>();
  private ice: RTCIceCandidateInit[] = [];
  private cursor = 0;
  private generation = 0;
  private disposed = false;
  private polling = false;
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private avoid: string | null = null;

  constructor(
    private topicId: string,
    private side: Side,
    private changed: (state: RoomState) => void
  ) {}
  private emit(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private fail(error: unknown) {
    if (this.disposed) return;
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
    this.emit({
      status: 'error',
      error:
        message.includes('Permission') || message.includes('NotAllowed')
          ? 'Izin mikrofon belum diberikan. Izinkan mikrofon di pengaturan browser lalu coba lagi.'
          : message
    });
  }
  async start() {
    if (
      !supabase ||
      this.disposed ||
      ['permission', 'searching', 'connecting', 'connected'].includes(this.state.status)
    )
      return;
    const generation = ++this.generation;
    this.emit({ status: 'permission', error: '' });
    try {
      const user = await ensureParticipant();
      if (this.disposed || generation !== this.generation) return;
      this.emit({ userId: user.id });
      const { error } = await supabase.rpc('leave_session');
      if (error) throw error;
      if (!this.voice.output) await this.voice.start();
      if (this.disposed || generation !== this.generation) {
        this.voice.stop();
        return;
      }
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const response = await fetch('/api/ice', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!response.ok) throw new Error('Konfigurasi jaringan panggilan gagal dimuat. Coba lagi.');
      const config = await response.json();
      this.iceServers = config.iceServers;
      this.emit({ relay: Boolean(config.relay) });
      if (this.disposed || generation !== this.generation) return;
      await this.search(generation);
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      await supabase.rpc('leave_session');
      this.voice.stop();
      this.fail(error);
    }
  }
  private async search(generation: number) {
    this.emit({ status: 'searching', error: '', messages: [], remote: null, match: null });
    const { data, error } = await supabase!.rpc('join_queue', {
      p_topic: this.topicId,
      p_side: this.side,
      p_avoid: this.avoid
    });
    if (generation !== this.generation || this.disposed) return;
    if (error) throw error;
    if (data) await this.attach(data as Match, generation);
    if (this.disposed || generation !== this.generation) return;
    this.timer = setInterval(() => this.poll(generation), 3000);
  }
  private async poll(generation: number) {
    if (this.polling || this.disposed || generation !== this.generation) return;
    this.polling = true;
    try {
      const { data, error } = await supabase!.rpc('session_status');
      if (error) throw error;
      if (generation !== this.generation || this.disposed) return;
      if (!data && this.state.match) {
        await this.finish(
          'Lawan bicara telah meninggalkan diskusi. Tekan Next untuk mencari pasangan baru.'
        );
        return;
      }
      if (data && !this.state.match) await this.attach(data as Match, generation);
      if (this.state.match) await this.fetchMessages(generation);
    } catch (error) {
      if (generation === this.generation && !this.disposed)
        this.emit({
          error: 'Koneksi ke server terganggu. Kami sedang mencoba menyambungkan kembali.'
        });
    } finally {
      this.polling = false;
    }
  }
  private async attach(match: Match, generation: number) {
    this.emit({ match, status: 'connecting', error: '' });
    const pc = (this.pc = new RTCPeerConnection({ iceServers: this.iceServers }));
    const remote = new MediaStream();
    const current = () => !this.disposed && generation === this.generation && this.pc === pc;
    pc.ontrack = (event) => {
      if (!current()) return;
      remote.addTrack(event.track);
      this.emit({ remote });
      event.track.onmute = event.track.onunmute = () => {
        if (current()) this.emit({ remote });
      };
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && current())
        void this.signal('ice', event.candidate.toJSON()).catch((error) =>
          this.emit({ error: String(error.message ?? error) })
        );
    };
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === 'connected') {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.emit({ status: 'connected', error: '' });
      } else if (pc.connectionState === 'failed') {
        void this.finish(
          'Koneksi panggilan terputus. Coba Next. Jika berulang di jaringan berbeda, periksa konfigurasi TURN.'
        );
      } else if (pc.connectionState === 'disconnected') {
        this.emit({ error: 'Jaringan panggilan terputus. Mencoba menyambungkan kembali…' });
        this.disconnectTimer = setTimeout(() => {
          if (current()) void this.finish('Lawan bicara terputus dari panggilan.');
        }, 20000);
      }
    };
    this.voice.output!.getAudioTracks().forEach((track) => pc.addTrack(track, this.voice.output!));
    const video = pc.addTransceiver('video', { direction: 'sendrecv' });
    if (this.voice.camera) await video.sender.replaceTrack(this.voice.camera.getVideoTracks()[0]);
    this.channel = supabase!
      .channel(`room:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `match_id=eq.${match.id}`
        },
        (payload) => {
          if (current()) this.enqueue(payload.new as RoomMessage, generation);
        }
      )
      .subscribe();
    // Database polling also recovers events sent before the subscription was ready.
    if (match.pro_user === this.state.userId) {
      const offer = await pc.createOffer();
      if (!current()) return;
      await pc.setLocalDescription(offer);
      await this.signal('offer', { type: offer.type, sdp: offer.sdp });
    }
    await this.fetchMessages(generation);
    setTimeout(() => {
      if (current() && this.state.status === 'connecting')
        void this.finish(
          'Panggilan belum berhasil tersambung. Coba Next atau periksa konfigurasi TURN.'
        );
    }, 40000);
  }
  private async fetchMessages(generation: number) {
    const match = this.state.match;
    if (!match) return;
    const { data, error } = await supabase!
      .from('room_messages')
      .select('*')
      .eq('match_id', match.id)
      .gt('id', this.cursor)
      .order('id')
      .limit(250);
    if (error) throw error;
    if (generation !== this.generation || this.disposed) return;
    for (const message of data ?? []) {
      this.enqueue(message as RoomMessage, generation);
      this.cursor = Math.max(this.cursor, message.id);
    }
    await this.processing;
  }
  private enqueue(message: RoomMessage, generation: number) {
    this.processing = this.processing
      .then(async () => {
        if (generation !== this.generation || this.disposed || this.seen.has(message.id)) return;
        this.seen.add(message.id);
        if (message.kind === 'chat') {
          this.emit({ messages: [...this.state.messages, message] });
          return;
        }
        if (message.sender_id === this.state.userId || !this.pc) return;
        const pc = this.pc;
        if (message.kind === 'ice') {
          if (pc.remoteDescription)
            await pc.addIceCandidate(message.payload as RTCIceCandidateInit);
          else this.ice.push(message.payload as RTCIceCandidateInit);
        } else {
          await pc.setRemoteDescription(message.payload as unknown as RTCSessionDescriptionInit);
          for (const candidate of this.ice) await pc.addIceCandidate(candidate);
          this.ice = [];
          if (message.kind === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.signal('answer', { type: answer.type, sdp: answer.sdp });
          }
        }
      })
      .catch((error) => {
        if (generation === this.generation)
          this.emit({ error: `Negosiasi panggilan gagal: ${error.message}` });
      });
  }
  private async signal(kind: RoomMessage['kind'], payload: unknown) {
    if (!this.state.match || this.disposed) return;
    const { error } = await supabase!
      .from('room_messages')
      .insert({ match_id: this.state.match.id, sender_id: this.state.userId, kind, payload });
    if (error) throw error;
  }
  async sendChat(text: string) {
    if (this.state.status !== 'connected' || !this.state.match)
      throw new Error('Tunggu sampai panggilan terhubung.');
    const { data, error } = await supabase!
      .from('room_messages')
      .insert({
        match_id: this.state.match.id,
        sender_id: this.state.userId,
        kind: 'chat',
        payload: { text: text.trim().slice(0, 2000) }
      })
      .select()
      .single();
    if (error) throw error;
    this.enqueue(data as RoomMessage, this.generation);
  }
  async toggleCamera() {
    const sender = this.pc
      ?.getTransceivers()
      .find((t) => t.receiver.track.kind === 'video')?.sender;
    if (this.voice.camera) {
      await sender?.replaceTrack(null);
      this.voice.disableCamera();
      this.emit({ local: null });
    } else {
      const stream = await this.voice.enableCamera();
      await sender?.replaceTrack(stream.getVideoTracks()[0]);
      this.emit({ local: stream });
    }
  }
  async next() {
    if (this.disposed || this.state.status === 'permission') return;
    const previous = this.state.match;
    if (previous)
      this.avoid =
        previous.pro_user === this.state.userId ? previous.kontra_user : previous.pro_user;
    const generation = ++this.generation;
    this.clearPeer();
    this.emit({ status: 'permission', match: null, remote: null, error: '' });
    try {
      const { error } = await supabase!.rpc('leave_session');
      if (error) throw error;
      if (generation === this.generation && !this.disposed) await this.search(generation);
    } catch (error) {
      this.fail(error);
    }
  }
  async report(reason: string, detail: string) {
    const match = this.state.match;
    if (!match) throw new Error('Belum ada sesi untuk dilaporkan.');
    const { error } = await supabase!.from('reports').insert({
      match_id: match.id,
      reporter_id: this.state.userId,
      reported_id: match.pro_user === this.state.userId ? match.kontra_user : match.pro_user,
      reason,
      detail
    });
    if (error) throw error;
    await this.finish(
      'Laporan diterima. Diskusi dihentikan dan pengguna ini tidak akan dipasangkan denganmu lagi.'
    );
  }
  private clearPeer() {
    if (this.timer) clearInterval(this.timer);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.timer = null;
    this.disconnectTimer = null;
    this.pc?.close();
    this.pc = null;
    if (this.channel) void supabase?.removeChannel(this.channel);
    this.channel = null;
    this.seen.clear();
    this.ice = [];
    this.cursor = 0;
    this.processing = Promise.resolve();
  }
  async finish(message = 'Diskusi selesai.') {
    ++this.generation;
    this.clearPeer();
    this.emit({ status: 'ended', remote: null, error: message });
    await supabase?.rpc('leave_session');
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    this.clearPeer();
    this.voice.stop();
    if (this.state.userId) void supabase?.rpc('leave_session');
  }
}
