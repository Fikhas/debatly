<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, Check, LockKeyhole } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
  import { supabase } from '#lib/supabase.ts';
  let password = $state('');
  let confirm = $state('');
  let ready = $state(false);
  let valid = $state(false);
  let busy = $state(false);
  let success = $state(false);
  let error = $state('');
  onMount(() => {
    void supabase?.auth.getUser().then(({ data }) => {
      valid = Boolean(data.user && !data.user.is_anonymous);
      ready = true;
    });
    if (!supabase) ready = true;
  });
  async function save(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    if (password !== confirm) {
      error = 'Konfirmasi kata sandi belum sama.';
      return;
    }
    busy = true;
    const { error: e } = await supabase!.auth.updateUser({ password });
    busy = false;
    if (e) error = e.message;
    else success = true;
  }
</script>

<svelte:head
  ><title>Reset kata sandi · debatly.</title><meta name="robots" content="noindex" /></svelte:head
>
<main class="reset-page">
  <Logo />
  <section>
    <span class="reset-icon"><LockKeyhole size={28} /></span>
    <h1>Kata sandi baru.</h1>
    <p>Gunakan kata sandi yang kuat dan unik untuk akun admin.</p>
    {#if !ready}<div class="notice">Memeriksa tautan…</div>{:else if success}<div
        class="success-box"
      >
        Kata sandi berhasil diperbarui.
      </div>
      <a href="/admin" class="button primary full">Kembali ke dashboard <Check size={16} /></a
      >{:else if !valid}<div class="error-box">
        Tautan tidak valid atau kedaluwarsa. Minta tautan baru dari halaman login admin.
      </div>
      <a class="button secondary full" href="/admin"><ArrowLeft size={15} /> Kembali ke login</a
      >{:else}<form onsubmit={save}>
        <label class="field"
          >Kata sandi baru<input
            type="password"
            minlength="12"
            required
            bind:value={password}
            autocomplete="new-password"
          /><small>Minimal 12 karakter.</small></label
        ><label class="field"
          >Konfirmasi kata sandi<input
            type="password"
            minlength="12"
            required
            bind:value={confirm}
            autocomplete="new-password"
          /></label
        >{#if error}<div class="error-box" role="alert">{error}</div>{/if}<button
          class="button primary full"
          disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</button
        >
      </form>{/if}
  </section>
</main>

<style>
  .reset-page {
    max-width: 460px;
    margin: 65px auto;
    padding: 0 20px;
  }
  .reset-page > section {
    border: 1px solid var(--line);
    background: #fffef9;
    padding: 30px;
    border-radius: 15px;
    margin-top: 35px;
  }
  .reset-icon {
    display: block;
    color: #8b9f75;
    margin-bottom: 20px;
  }
  .reset-page h1 {
    font-size: 26px;
    letter-spacing: -1px;
    font-weight: 650;
  }
  .reset-page p {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.8;
    margin-top: 12px;
    margin-bottom: 25px;
  }
</style>
