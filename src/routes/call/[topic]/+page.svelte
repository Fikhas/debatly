<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Dialog } from 'bits-ui';
  import {
    ArrowLeft,
    ArrowRight,
    AudioLines,
    Check,
    ChevronDown,
    Flag,
    Headphones,
    LoaderCircle,
    MessageCircle,
    Mic,
    MicOff,
    PhoneOff,
    Send,
    ShieldCheck,
    Shuffle,
    SlidersHorizontal,
    Volume2,
    X
  } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
  import { configured, supabase } from '#lib/supabase.ts';
  import { previewTopics } from '#lib/topics.ts';
  import { DebateRoom, type RoomState } from '#lib/room.ts';
  import { VoiceEngine } from '#lib/media.ts';
  import type { Side, Topic } from '#lib/types.ts';

  const side: Side = page.url.searchParams.get('side') === 'kontra' ? 'kontra' : 'pro';
  let topic = $state<Topic | null>(null);
  let topicError = $state('');
  let roomState = $state<RoomState>({
    status: 'idle',
    error: '',
    messages: [],
    remote: null,
    local: null,
    match: null,
    userId: '',
    relay: false
  });
  let room: DebateRoom;
  let previewVoice: VoiceEngine;
  let micReady = $state(false);
  let muted = $state(false);
  let pitch = $state(0);
  let listen = $state(false);
  let settings = $state(true);
  let draft = $state('');
  let sending = $state(false);
  let actionError = $state('');
  let reportOpen = $state(false);
  let reportReason = $state('Ujaran kebencian');
  let reportDetail = $state('');
  let reporting = $state(false);
  let previewStarting = $state(false);
  let elapsed = $state(0);
  let chatLog = $state<HTMLDivElement>();
  let remoteAudio = $state<HTMLAudioElement>();
  let remoteVideo = $state<HTMLVideoElement>();
  let localVideo = $state<HTMLVideoElement>();
  let needsPlayback = $state(false);
  let disposed = false;
  let active = $derived(
    ['searching', 'connecting', 'connected', 'permission'].includes(roomState.status)
  );
  let voice = () => (configured ? room?.voice : previewVoice);
  let statusLabel = $derived(
    {
      idle: 'Siap untuk perspektif baru?',
      permission: 'Menyiapkan mikrofon…',
      searching: 'Mencari perspektif yang berbeda…',
      connecting: 'Lawan ditemukan. Menghubungkan…',
      connected: 'Diskusi sedang berlangsung',
      ended: 'Diskusi telah berakhir',
      error: 'Panggilan belum bisa dimulai'
    }[roomState.status]
  );
  let time = $derived(
    `${Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
  );

  onMount(() => {
    previewVoice = new VoiceEngine();
    room = new DebateRoom(page.params.topic!, side, (next) => {
      roomState = { ...next };
      micReady = Boolean(room.voice.output);
    });
    async function load() {
      if (supabase) {
        const { data, error } = await supabase
          .from('topics')
          .select('*')
          .eq('id', page.params.topic)
          .eq('active', true)
          .single();
        if (disposed) return;
        if (error || !data) {
          topicError = 'Topik ini tidak tersedia atau sudah dinonaktifkan.';
          return;
        }
        topic = data;
      } else topic = previewTopics().find((t) => t.id === page.params.topic && t.active) ?? null;
      if (!topic) topicError = 'Topik tidak ditemukan.';
      else if (configured) await start();
    }
    void load();
    const timer = setInterval(() => {
      if (roomState.status === 'connected') elapsed += 1;
    }, 1000);
    const unload = () => {
      room.dispose();
      previewVoice.stop();
    };
    window.addEventListener('pagehide', unload);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('pagehide', unload);
      unload();
    };
  });
  beforeNavigate(() => {
    room?.dispose();
    previewVoice?.stop();
  });
  $effect(() => {
    const remote = roomState.remote;
    if (remoteAudio && remote) {
      remoteAudio.srcObject = remote;
      remoteAudio.play().catch(() => (needsPlayback = true));
    }
    if (remoteVideo) remoteVideo.srcObject = remote;
    if (localVideo) localVideo.srcObject = roomState.local;
  });
  $effect(() => {
    void roomState.messages.length;
    tick().then(() => {
      if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    });
  });
  $effect(() => {
    voice()?.setPitch(pitch);
  });
  $effect(() => {
    if (roomState.status === 'searching') elapsed = 0;
  });
  async function start() {
    actionError = '';
    if (configured) {
      await room.start();
      room.voice.setPitch(pitch);
      room.voice.setMuted(muted);
    } else {
      previewStarting = true;
      try {
        await previewVoice.start();
        if (!disposed) {
          micReady = true;
          previewVoice.setPitch(pitch);
          previewVoice.setMuted(muted);
        }
      } catch (error) {
        actionError = error instanceof Error ? error.message : 'Izin mikrofon belum diberikan.';
      } finally {
        previewStarting = false;
      }
    }
  }
  function toggleMic() {
    muted = !muted;
    voice()?.setMuted(muted);
  }
  async function next() {
    actionError = '';
    listen = false;
    voice()?.listen(false);
    await room.next();
  }
  function toggleListen() {
    listen = !listen;
    voice()?.listen(listen);
  }
  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    sending = true;
    actionError = '';
    try {
      await room.sendChat(draft);
      draft = '';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Pesan gagal dikirim.';
    } finally {
      sending = false;
    }
  }
  async function report(event: SubmitEvent) {
    event.preventDefault();
    reporting = true;
    actionError = '';
    try {
      await room.report(reportReason, reportDetail);
      reportOpen = false;
    } catch {
      actionError = 'Laporan gagal dikirim atau sesi ini sudah dilaporkan. Coba lagi.';
    } finally {
      reporting = false;
    }
  }
  async function exit() {
    room?.dispose();
    previewVoice?.stop();
    await goto('/');
  }
</script>

<svelte:head
  ><title>{topic ? `${topic.title} — ` : ''}Ruang debat · debatly.</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>

<div class="call-page">
  <header class="call-header">
    <Logo small /><span class="call-header-caption"
      ><ShieldCheck size={14} /> Ruang privat · 1 lawan 1</span
    ><button class="button secondary small" onclick={exit}><ArrowLeft size={14} /> Kembali</button>
  </header>
  <main class="call-main">
    {#if topicError}<div class="empty-roomState">
        <h2>{topicError}</h2>
        <a class="button primary" href="/">Pilih topik lain <ArrowRight size={16} /></a>
      </div>{:else}
      <div class="call-topic-bar">
        <div>
          <span class="eyebrow orange">{topic?.category ?? 'MENYIAPKAN RUANG'}</span>
          <h1>{topic?.title ?? 'Memuat topik diskusi…'}</h1>
        </div>
        <span class="position-chip {side}"
          >Posisimu: <strong>{side === 'pro' ? 'Pro' : 'Kontra'}</strong></span
        >
      </div>
      {#if !configured}<div class="preview-banner">
          <span><span class="live-dot"></span> Ruang pratinjau</span> Belum terhubung ke pengguna lain.
          Coba mikrofon dan pengubah suara secara lokal.
        </div>{/if}
      <div class="room-layout">
        <div class="video-column">
          <div class="video-panel remote-panel">
            <video
              bind:this={remoteVideo}
              autoplay
              playsinline
              muted
              class:visible={roomState.remote
                ?.getVideoTracks()
                .some((t) => !t.muted && t.readyState === 'live')}
            ></video>
            <div class="video-overlay">
              <span class="video-name"
                ><span class="live-dot"></span>
                {roomState.match ? 'Lawan bicara' : 'Perspektif lainnya'}</span
              ><span class="position-chip {side === 'pro' ? 'kontra' : 'pro'}"
                >{side === 'pro' ? 'Kontra' : 'Pro'}</span
              >
            </div>
            {#if !roomState.remote
              ?.getVideoTracks()
              .some((t) => !t.muted && t.readyState === 'live')}
              <div class="remote-placeholder">
                <div class="voice-orb" class:searching={roomState.status === 'searching'}>
                  {#if roomState.status === 'searching' || roomState.status === 'connecting' || roomState.status === 'permission'}<LoaderCircle
                      size={35}
                      class="spin"
                    />{:else}<AudioLines size={40} />{/if}
                </div>
                <h2>{configured ? statusLabel : 'Ruang untuk suara yang berbeda.'}</h2>
                <p>
                  {roomState.status === 'connected'
                    ? 'Dengarkan perspektif lawan bicara.'
                    : roomState.status === 'searching'
                      ? `Menunggu peserta ${side === 'pro' ? 'kontra' : 'pro'} pada topik yang sama. Kamu bisa membatalkan kapan saja.`
                      : !configured
                        ? 'Percakapan hidup lewat suara.'
                        : 'Siapkan mikrofon untuk memulai percakapan.'}
                </p>
                {#if ['idle', 'error'].includes(roomState.status) && configured}<button
                    class="button primary"
                    disabled={!topic}
                    onclick={start}
                    ><Mic size={16} />
                    {roomState.status === 'error' ? 'Coba lagi' : 'Mulai pencarian'}</button
                  >{/if}{#if !configured && !micReady}<button
                    class="button primary"
                    disabled={previewStarting}
                    onclick={start}
                    >{#if previewStarting}<LoaderCircle size={16} class="spin" />{:else}<Mic
                        size={16}
                      />{/if} Coba mikrofon</button
                  >{/if}
              </div>
            {/if}
            <div class="video-bottom">
              <span><ShieldCheck size={13} /> Anonim & setara</span
              >{#if roomState.status === 'connected'}<span class="call-timer"
                  ><span class="live-dot"></span>{time}</span
                >{:else}<span><AudioLines size={13} /> Obrolan suara</span>{/if}
            </div>
          </div>
          <div class="video-panel local-panel">
            <video
              bind:this={localVideo}
              autoplay
              playsinline
              muted
              class:visible={Boolean(roomState.local)}
            ></video>
            <div class="video-overlay">
              <span class="video-name"
                >Kamu <span class="you-label"
                  >{muted ? 'Mic mati' : micReady ? 'Mic aktif' : 'Mic belum aktif'}</span
                ></span
              ><span class="position-chip {side}">{side === 'pro' ? 'Pro' : 'Kontra'}</span>
            </div>
            {#if !roomState.local}<div class="local-placeholder">
                <span class="local-avatar">{muted ? '…' : 'K'}</span>
                <div>
                  <strong>Suaramu sudah cukup.</strong><span
                    >Sampaikan perspektifmu lewat suara.</span
                  >
                </div>
                <AudioLines size={21} />
              </div>{/if}
          </div>
        </div>

        <section class="chat-panel" aria-label="Pesan teks">
          <div class="chat-heading">
            <div>
              <MessageCircle size={18} />
              <h2>Obrolan</h2>
            </div>
            <span>{roomState.status === 'connected' ? 'Terhubung' : 'Ruang diskusi'}</span>
          </div>
          <div class="chat-messages" bind:this={chatLog} role="log" aria-label="Riwayat pesan">
            <div class="chat-welcome">
              <span class="chat-welcome-icon"><ShieldCheck size={24} /></span>
              <h3>Selamat datang di ruang temu.</h3>
              <p>Kamu dan lawan bicara mungkin berbeda pandangan. Mulai dengan saling mendengar.</p>
              <span>Jaga informasi pribadimu tetap privat.</span>
            </div>
            {#if roomState.status === 'searching'}<div class="system-message">
                <LoaderCircle size={13} class="spin" /> Mencari peserta dengan posisi berseberangan…
              </div>{/if}{#if roomState.match}<div class="system-message">
                <Check size={14} /> Lawan bicara ditemukan. Sampaikan argumenmu dengan respek.
              </div>{/if}{#each roomState.messages as message}<div
                class="chat-message"
                class:own={message.sender_id === roomState.userId}
              >
                <span>{message.sender_id === roomState.userId ? 'Kamu' : 'Lawan bicara'}</span>
                <p>{String(message.payload.text)}</p>
                <time
                  >{new Date(message.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</time
                >
              </div>{/each}
          </div>
          <form class="chat-compose" onsubmit={send}>
            <input
              bind:value={draft}
              aria-label="Pesan teks"
              maxlength="2000"
              disabled={roomState.status !== 'connected'}
              placeholder={roomState.status === 'connected'
                ? 'Tulis pesanmu…'
                : 'Chat tersedia setelah terhubung'}
            /><button
              aria-label="Kirim pesan"
              disabled={roomState.status !== 'connected' || !draft.trim() || sending}
              ><Send size={18} /></button
            >
          </form>
          <div class="chat-note">Kritik idenya. Hargai orangnya.</div>
        </section>
      </div>
      {#if needsPlayback}<button
          class="button secondary full"
          onclick={async () => {
            try {
              await remoteAudio?.play();
              needsPlayback = false;
            } catch {
              actionError = 'Klik lagi untuk mengaktifkan audio.';
            }
          }}><Volume2 size={16} /> Klik untuk mendengar lawan bicara</button
        >{/if}
      <div class="room-controls">
        <div class="media-controls">
          <button
            class="control-button"
            class:off={muted}
            onclick={toggleMic}
            disabled={!micReady}
            aria-label={muted ? 'Nyalakan mikrofon' : 'Matikan mikrofon'}
            aria-pressed={!muted}
            >{#if muted}<MicOff size={20} />{:else}<Mic size={20} />{/if}<span
              >{muted ? 'Mic mati' : 'Mikrofon'}</span
            ></button
          ><button
            class="control-button"
            class:chosen={settings}
            onclick={() => (settings = !settings)}
            aria-expanded={settings}><SlidersHorizontal size={20} /><span>Ubah suara</span></button
          >
        </div>
        <div class="session-controls">
          <button
            class="button secondary"
            disabled={!configured || !micReady || roomState.status === 'permission'}
            onclick={next}><Shuffle size={17} /> Next</button
          ><button class="button danger" onclick={exit}><PhoneOff size={17} /> Stop / Exit</button>
        </div>
      </div>
      {#if settings}<section class="voice-settings">
          <div class="voice-settings-label">
            <span class="settings-icon"><AudioLines size={21} /></span>
            <div>
              <h3>Suaramu, versi samaran.</h3>
              <p>Ubah pitch tanpa mengubah kecepatan bicara.</p>
            </div>
          </div>
          <div class="pitch-control">
            <div>
              <span>Lebih rendah</span><strong
                >{pitch > 0 ? '+' : ''}{pitch} <small>semitone</small></strong
              ><span>Lebih tinggi</span>
            </div>
            <input
              type="range"
              min="-6"
              max="6"
              step="1"
              bind:value={pitch}
              aria-label="Pitch suara"
              oninput={(event) => {
                pitch = Number(event.currentTarget.value);
                voice()?.setPitch(pitch);
              }}
            />
            <div class="pitch-presets">
              {#each [{ label: 'Rendah', value: -4 }, { label: 'Asli', value: 0 }, { label: 'Tinggi', value: 4 }] as preset}<button
                  class:chosen={pitch === preset.value}
                  onclick={() => {
                    pitch = preset.value;
                    voice()?.setPitch(pitch);
                  }}>{preset.label}</button
                >{/each}
            </div>
          </div>
          <button
            class="button secondary small"
            class:listening={listen}
            disabled={!micReady}
            onclick={toggleListen}
            ><Headphones size={16} />{listen ? 'Hentikan tes' : 'Dengar suaramu'}</button
          >
          <p class="voice-disclaimer">
            Gunakan headphone saat tes. Perubahan pitch tidak menjamin identitas suara sepenuhnya
            tersamarkan.
          </p>
        </section>{/if}
      <div aria-live="polite">
        {#if roomState.error}<div
            class:error-box={roomState.status === 'error'}
            class:notice={roomState.status !== 'error'}
          >
            {roomState.error}
          </div>{/if}{#if actionError}<div class="error-box" role="alert">{actionError}</div>{/if}
      </div>
      <div class="room-bottom">
        <span
          ><ShieldCheck size={13} />
          {configured && active && !roomState.relay
            ? 'Koneksi STUN · relay TURN belum dikonfigurasi'
            : 'Panggilan tidak direkam oleh aplikasi'}</span
        >
        <div>
          <a href="/panduan" target="_blank" rel="noreferrer">Aturan diskusi</a><button
            disabled={!roomState.match || reporting}
            onclick={() => (reportOpen = true)}><Flag size={13} /> Laporkan</button
          >
        </div>
      </div>
    {/if}
  </main>
  <audio bind:this={remoteAudio} autoplay></audio>
</div>

<Dialog.Root bind:open={reportOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class="modal-overlay" /><Dialog.Content class="modal"
      ><Dialog.Close class="close-button" aria-label="Tutup laporan"><X size={18} /></Dialog.Close
      ><span class="eyebrow orange">JAGA RUANG INI BERSAMA</span><Dialog.Title class="modal-title"
        >Laporkan lawan bicara</Dialog.Title
      ><Dialog.Description class="modal-description"
        >Laporan akan diteruskan kepada admin dan panggilan dihentikan. Kalian tidak akan
        dipasangkan kembali.</Dialog.Description
      >
      <form onsubmit={report}>
        <label class="field"
          >Alasan<select bind:value={reportReason}
            >{#each ['Ujaran kebencian', 'Pelecehan atau ancaman', 'Konten tidak pantas', 'Spam', 'Lainnya'] as reason}<option
                >{reason}</option
              >{/each}</select
          ></label
        ><label class="field"
          >Detail (opsional)<textarea
            bind:value={reportDetail}
            maxlength="2000"
            placeholder="Jelaskan apa yang terjadi tanpa membagikan informasi pribadi."
          ></textarea></label
        >{#if actionError}<p class="error-box">{actionError}</p>{/if}<button
          class="button danger full"
          disabled={reporting}
          >{reporting ? 'Mengirim laporan…' : 'Kirim laporan & hentikan panggilan'}</button
        >
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>

<style>
  .call-page {
    min-height: 100dvh;
    background: #f4f5ef;
  }
  .call-header {
    height: 76px;
    padding: 0 38px;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .call-header-caption {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #939b88;
    font-size: 10px;
  }
  .call-main {
    max-width: 1280px;
    margin: 0 auto;
    padding: 28px 38px;
  }
  .call-topic-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 22px;
    margin-bottom: 23px;
  }
  .call-topic-bar h1 {
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.6px;
    margin-top: 9px;
  }
  .position-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 5px;
    padding: 6px 9px;
    font-size: 10px;
    white-space: nowrap;
  }
  .pro {
    color: #607d51;
    background: #e6eedb;
  }
  .kontra {
    color: #a97255;
    background: #fae7db;
  }
  .room-layout {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 18px;
    margin-top: 18px;
  }
  .video-column {
    display: flex;
    flex-direction: column;
    gap: 13px;
  }
  .video-panel {
    position: relative;
    border-radius: 13px;
    overflow: hidden;
    background: #263b30;
    color: #e7ecdf;
  }
  .remote-panel {
    min-height: 325px;
    flex: 1;
  }
  .video-panel video {
    pointer-events: none;
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
  }
  .video-panel video.visible {
    opacity: 1;
  }
  .local-panel video {
    transform: scaleX(-1);
  }
  .video-overlay {
    position: absolute;
    top: 15px;
    left: 17px;
    right: 17px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2;
  }
  .video-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    background: #23322b99;
    border-radius: 5px;
    padding: 6px 8px;
    color: #f0f3e9;
  }
  .video-overlay .position-chip {
    font-size: 9px;
    padding: 4px 8px;
    background: #eef2e4e8;
  }
  .video-overlay .position-chip.kontra {
    background: #f6e3d7e8;
  }
  .remote-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 325px;
    padding: 55px 28px 45px;
  }
  .voice-orb {
    background: #ffffff08;
    border: 1px solid #b5c7a527;
    box-shadow:
      0 0 0 15px #b4c7a505,
      0 0 0 30px #b4c7a503;
    color: #c0d2b1;
    border-radius: 50%;
    width: 78px;
    height: 78px;
    display: grid;
    place-items: center;
    margin-bottom: 25px;
  }
  .voice-orb.searching {
    box-shadow:
      0 0 0 15px #b4c7a50a,
      0 0 0 30px #b4c7a505;
  }
  .remote-placeholder h2 {
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.4px;
  }
  .remote-placeholder p {
    font-size: 11px;
    line-height: 1.8;
    color: #9daa96;
    max-width: 320px;
    margin-top: 10px;
  }
  .remote-placeholder .button {
    margin-top: 20px;
    padding: 10px 18px;
    font-size: 11px;
    min-height: 38px;
  }
  .video-bottom {
    position: absolute;
    bottom: 14px;
    left: 19px;
    right: 19px;
    display: flex;
    justify-content: space-between;
    color: #a7b59e;
    font-size: 9px;
  }
  .video-bottom > span {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .local-panel {
    height: 155px;
    background: #e6eadf;
    color: var(--ink);
  }
  .local-panel .video-name {
    background: #f5f7efd9;
    color: #56654b;
  }
  .you-label {
    font-size: 8px;
    color: #929d86;
  }
  .local-placeholder {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 45px 20px 15px;
  }
  .local-avatar {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    background: #cdd7c2;
    color: #697c57;
    border-radius: 50%;
    font-size: 19px;
  }
  .local-placeholder strong {
    font-size: 12px;
    font-weight: 550;
    display: block;
  }
  .local-placeholder div > span {
    display: block;
    font-size: 9px;
    color: #949e87;
    margin-top: 7px;
  }
  .local-placeholder > :global(svg) {
    color: #a2ac98;
    margin-left: 20px;
  }
  .chat-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid #dfe4d5;
    background: #fcfcf8;
    border-radius: 13px;
    overflow: hidden;
    min-height: 493px;
    max-height: 650px;
  }
  .chat-heading {
    padding: 19px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e8ebdf;
  }
  .chat-heading > div {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .chat-heading h2 {
    font-size: 13px;
    letter-spacing: 0;
  }
  .chat-heading :global(svg) {
    color: #8c9b7c;
  }
  .chat-heading > span {
    font-size: 9px;
    color: #a2aa96;
  }
  .chat-messages {
    flex: 1;
    overflow: auto;
    padding: 20px;
    min-height: 220px;
    max-height: 440px;
    scrollbar-width: thin;
  }
  .chat-welcome {
    text-align: center;
    padding: 20px 22px;
    margin-top: 15px;
  }
  .chat-welcome-icon {
    display: grid;
    place-items: center;
    margin: 0 auto 16px;
    border-radius: 13px;
    background: #eff2e7;
    color: #8e9e7c;
    width: 48px;
    height: 48px;
  }
  .chat-welcome h3 {
    font-size: 13px;
    font-weight: 600;
  }
  .chat-welcome p {
    font-size: 11px;
    color: #9aa18e;
    line-height: 1.9;
    margin: 11px auto 16px;
    max-width: 250px;
  }
  .chat-welcome > span:last-child {
    font-size: 9px;
    color: #b0b6a6;
  }
  .chat-compose {
    display: flex;
    gap: 10px;
    padding: 12px 15px;
    border-top: 1px solid #e8ebdf;
  }
  .chat-compose input {
    background: #f0f2e9;
    border: 1px solid #e9eddf;
    border-radius: 8px;
    padding: 12px;
    flex: 1;
    font-size: 11px;
  }
  .chat-compose button {
    width: 40px;
    border-radius: 8px;
    background: #78945f;
    color: white;
    display: grid;
    place-items: center;
  }
  .chat-note {
    text-align: center;
    color: #acb39e;
    font-size: 9px;
    padding: 0 0 11px;
  }
  .system-message {
    font-size: 10px;
    line-height: 1.8;
    color: #9da58f;
    display: flex;
    gap: 6px;
    justify-content: center;
    align-items: center;
    text-align: center;
    margin: 10px 0 20px;
  }
  .chat-message {
    margin-bottom: 15px;
    max-width: 85%;
    width: fit-content;
  }
  .chat-message > span {
    font-size: 9px;
    color: #9fa790;
  }
  .chat-message p {
    background: #eef0e8;
    padding: 10px 13px;
    border-radius: 0 11px 11px 11px;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin-top: 5px;
  }
  .chat-message time {
    font-size: 8px;
    color: #adb49f;
    display: block;
    margin-top: 5px;
  }
  .chat-message.own {
    margin-left: auto;
    text-align: right;
  }
  .chat-message.own p {
    background: #e2ecd8;
    text-align: left;
    border-radius: 11px 0 11px 11px;
  }
  .room-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin: 19px 0;
  }
  .media-controls {
    display: flex;
    gap: 9px;
  }
  .control-button {
    display: flex;
    gap: 8px;
    align-items: center;
    border: 1px solid #dde3d3;
    padding: 12px 15px;
    border-radius: 8px;
    background: #fff;
    color: #66775a;
    font-size: 10px;
  }
  .control-button.off {
    color: #9da58f;
    background: #ecf0e4;
  }
  .control-button.chosen {
    border-color: #9eaf8b;
    background: #e9efdf;
  }
  .session-controls {
    display: flex;
    gap: 9px;
  }
  .session-controls .button {
    font-size: 11px;
    padding: 12px 18px;
  }
  .voice-settings {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 20px;
    align-items: center;
    padding: 20px 24px;
    border: 1px solid #dce3ce;
    background: #edf1e4;
    border-radius: 11px;
  }
  .voice-settings-label {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .settings-icon {
    width: 39px;
    height: 39px;
    display: grid;
    place-items: center;
    border: 1px solid #d8e2c7;
    background: #e6edd9;
    border-radius: 10px;
    color: #7e9567;
  }
  .voice-settings h3 {
    font-size: 12px;
    font-weight: 600;
  }
  .voice-settings-label p {
    font-size: 9px;
    color: #9aa68a;
    margin-top: 6px;
  }
  .pitch-control > div:first-child {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: #94a080;
  }
  .pitch-control strong {
    font-size: 12px;
    font-weight: 650;
    color: #6d8059;
  }
  .pitch-control small {
    font-size: 8px;
    font-weight: 400;
  }
  .pitch-control input {
    width: 100%;
    accent-color: #78945f;
    height: 4px;
    margin-top: 13px;
  }
  .pitch-presets {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-top: 9px;
  }
  .pitch-presets button {
    font-size: 8px;
    padding: 3px 10px;
    border-radius: 4px;
    background: transparent;
    color: #9eaa8d;
  }
  .pitch-presets .chosen {
    background: #dee8d0;
    color: #6b8155;
  }
  .voice-disclaimer {
    grid-column: 1/-1;
    text-align: center;
    font-size: 8px;
    color: #a0ab92;
    margin-top: -7px;
    line-height: 1.8;
  }
  .voice-settings .button {
    font-size: 9px;
  }
  .voice-settings .button.listening {
    background: #d8e7c7;
    border-color: #8aa46e;
  }
  .room-bottom {
    display: flex;
    justify-content: space-between;
    margin-top: 19px;
    gap: 12px;
    color: #9ba68c;
    font-size: 9px;
  }
  .room-bottom > span,
  .room-bottom > div,
  .room-bottom button {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .room-bottom > div {
    gap: 17px;
  }
  .room-bottom button {
    background: transparent;
    color: #a39179;
    padding: 0;
    font-size: 9px;
  }
  .spin {
    animation: spin 1.6s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 900px) {
    .call-header {
      padding: 0 20px;
    }
    .call-main {
      padding: 22px 20px;
    }
    .call-header-caption {
      display: none;
    }
    .call-topic-bar h1 {
      font-size: 17px;
    }
    .room-layout {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .voice-settings {
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .voice-settings > .button {
      grid-column: 1/-1;
      justify-self: center;
    }
    .voice-disclaimer {
      margin-top: -8px;
    }
    .control-button {
      padding: 12px;
    }
    .control-button > span {
      display: none;
    }
    .remote-placeholder {
      padding-inline: 18px;
    }
    .remote-placeholder h2 {
      font-size: 16px;
    }
    .local-placeholder > :global(svg) {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .call-main {
      padding: 20px 14px;
    }
    .call-header {
      height: 66px;
      padding-inline: 16px;
    }
    .call-topic-bar {
      gap: 12px;
    }
    .call-topic-bar h1 {
      font-size: 15px;
      line-height: 1.6;
    }
    .call-topic-bar > .position-chip {
      align-self: start;
      margin-top: 20px;
      padding: 6px;
      font-size: 8px;
    }
    .room-layout {
      grid-template-columns: 1fr;
    }
    .video-column {
      position: relative;
    }
    .remote-panel {
      min-height: 300px;
    }
    .remote-placeholder {
      min-height: 300px;
      padding-top: 65px;
      padding-bottom: 100px;
    }
    .remote-placeholder h2 {
      font-size: 16px;
    }
    .voice-orb {
      width: 58px;
      height: 58px;
      margin-bottom: 20px;
    }
    .voice-orb :global(svg) {
      width: 30px;
    }
    .local-panel {
      position: absolute;
      bottom: 10px;
      right: 10px;
      width: 125px;
      height: 85px;
      border: 2px solid #ffffff22;
      border-radius: 9px;
      z-index: 4;
    }
    .local-panel .video-overlay {
      top: 5px;
      left: 5px;
      right: 5px;
    }
    .local-panel .position-chip,
    .local-panel .you-label {
      display: none;
    }
    .local-panel .video-name {
      font-size: 7px;
      padding: 3px 5px;
    }
    .local-placeholder {
      padding: 25px 10px 10px;
    }
    .local-avatar {
      width: 30px;
      height: 30px;
      font-size: 13px;
    }
    .local-placeholder > div {
      display: none;
    }
    .video-bottom {
      bottom: 16px;
      right: 150px;
    }
    .video-bottom > span:last-child {
      display: none;
    }
    .chat-panel {
      min-height: 300px;
      max-height: 390px;
    }
    .chat-heading {
      padding: 14px 16px;
    }
    .chat-welcome {
      padding: 10px;
      margin-top: 0;
    }
    .chat-welcome p {
      font-size: 10px;
    }
    .chat-welcome-icon {
      width: 32px;
      height: 32px;
      margin-bottom: 9px;
    }
    .chat-welcome-icon :global(svg) {
      width: 20px;
    }
    .chat-messages {
      min-height: 160px;
      padding: 14px;
    }
    .chat-welcome > span:last-child {
      font-size: 8px;
    }
    .room-controls {
      gap: 8px;
    }
    .media-controls {
      gap: 5px;
    }
    .control-button {
      padding: 10px;
    }
    .control-button :global(svg) {
      width: 17px;
    }
    .session-controls {
      gap: 5px;
    }
    .session-controls .button {
      font-size: 9px;
      gap: 7px;
      padding: 10px 12px;
      min-height: 39px;
    }
    .session-controls .button :global(svg) {
      width: 14px;
    }
    .voice-settings {
      grid-template-columns: 1fr;
      padding: 18px;
      gap: 17px;
    }
    .voice-settings-label p {
      font-size: 10px;
    }
    .pitch-control {
      width: 100%;
    }
    .voice-disclaimer {
      font-size: 8px;
    }
    .room-bottom {
      font-size: 8px;
      flex-wrap: wrap;
      line-height: 1.7;
    }
    .room-bottom > div {
      margin-left: auto;
    }
    .room-bottom button {
      font-size: 8px;
    }
  }
</style>
