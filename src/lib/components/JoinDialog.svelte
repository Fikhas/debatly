<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { goto } from '$app/navigation';
  import {
    ArrowRight,
    Check,
    Mic,
    ShieldCheck,
    ThumbsDown,
    ThumbsUp,
    VideoOff,
    X
  } from '@lucide/svelte';
  import { configured } from '#lib/supabase.ts';
  import type { Side, Topic } from '#lib/types.ts';
  let { topic, open = $bindable(false) }: { topic: Topic | null; open?: boolean } = $props();
  let side = $state<Side | null>(null);
  let agreed = $state(false);
  $effect(() => {
    if (open) {
      side = null;
      agreed = false;
    }
  });
  function join() {
    if (topic && side && agreed) {
      open = false;
      goto(`/call/${topic.id}?side=${side}`);
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="modal-overlay" />
    <Dialog.Content class="modal join-modal">
      <Dialog.Close class="close-button" aria-label="Tutup"><X size={20} /></Dialog.Close>
      <span class="eyebrow">SATU TOPIK, DUA PERSPEKTIF</span>
      <Dialog.Title class="modal-title">Kamu di sisi mana?</Dialog.Title>
      <Dialog.Description class="modal-description">{topic?.title}</Dialog.Description>
      <div class="side-options">
        <button
          class:selected={side === 'pro'}
          class="side-option pro"
          onclick={() => (side = 'pro')}
          aria-pressed={side === 'pro'}
          ><span class="side-icon"><ThumbsUp size={24} /></span><strong>Pro</strong><span
            >Saya mendukung</span
          >{#if side === 'pro'}<Check class="side-check" size={18} />{/if}</button
        >
        <button
          class:selected={side === 'kontra'}
          class="side-option kontra"
          onclick={() => (side = 'kontra')}
          aria-pressed={side === 'kontra'}
          ><span class="side-icon"><ThumbsDown size={24} /></span><strong>Kontra</strong><span
            >Saya menentang</span
          >{#if side === 'kontra'}<Check class="side-check" size={18} />{/if}</button
        >
      </div>
      <div class="join-notes">
        <span><Mic size={16} /> Obrolan lewat suara</span><span
          ><VideoOff size={16} /> Kamera opsional</span
        >
      </div>
      <label class="consent"
        ><input type="checkbox" bind:checked={agreed} /><span
          >Saya berusia 18+ dan setuju dengan <a href="/panduan" target="_blank" rel="noreferrer"
            >aturan diskusi</a
          >. Saya akan menghargai lawan bicara.</span
        ></label
      >
      {#if !configured}<div class="notice">
          Mode pratinjau: kamu bisa mencoba ruang call. Hubungkan Supabase untuk bertemu pengguna
          lain.
        </div>{/if}
      <button class="button primary full" disabled={!side || !agreed} onclick={join}
        >{configured ? 'Cari lawan bicara' : 'Coba ruang debat'}<ArrowRight size={18} /></button
      >
      <p class="modal-footnote">
        <ShieldCheck size={14} /> Tanpa nama asli. Tanpa kewajiban menyalakan kamera.
      </p>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
