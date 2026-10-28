<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, MessageCircle } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
</script>

<svelte:head><title>{page.status} · Callbate</title></svelte:head>
<main class="error-page">
  <Logo />
  <div>
    <MessageCircle size={40} /><span>{page.status}</span>
    <h1>{page.status === 404 ? 'Ruang ini belum ada.' : 'Ada gangguan sebentar.'}</h1>
    <p>
      {page.status === 404
        ? 'Mari kembali dan temukan topik untuk obrolan berikutnya.'
        : 'Muat ulang halaman atau kembali ke beranda untuk mencoba lagi.'}
    </p>
    <a href="/" class="button primary"><ArrowLeft size={16} /> Kembali ke beranda</a>
  </div>
</main>

<style>
  .error-page {
    max-width: 900px;
    margin: 40px auto;
    padding: 0 25px;
  }
  .error-page > div {
    padding: 100px 10px;
    text-align: center;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 18px;
  }
  .error-page > div > :global(svg) {
    color: #90a277;
  }
  .error-page span {
    font-size: 11px;
    color: #a3ad96;
    letter-spacing: 3px;
  }
  .error-page h1 {
    font-size: 32px;
    letter-spacing: -1px;
    font-weight: 650;
  }
  .error-page p {
    font-size: 13px;
    line-height: 1.8;
    color: #8e9b80;
    max-width: 370px;
  }
  .error-page .button {
    margin-top: 10px;
  }
</style>
