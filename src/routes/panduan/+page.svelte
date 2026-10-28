<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    AudioLines,
    Handshake,
    HeartHandshake,
    LockKeyhole,
    ShieldCheck,
    VideoOff
  } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
</script>

<svelte:head
  ><title>Aturan & privasi · Callbate</title><meta
    name="description"
    content="Panduan berdiskusi dengan respek, keamanan panggilan, dan penjelasan privasi data di Callbate."
  /></svelte:head
>
<header class="site-header container">
  <Logo /><a class="button secondary small" href="/"><ArrowLeft size={15} /> Kembali</a>
</header>
<main class="guide container">
  <span class="eyebrow orange">BEDA SUARA, TETAP SETARA</span>
  <h1>Ruang debat yang<br />nyaman dimulai dari kita.</h1>
  <p class="intro">
    Tujuan kita bukan selalu mengubah pikiran orang lain. Kadang, cukup memahami mengapa mereka
    berpikir berbeda.
  </p>
  <div class="guide-grid">
    <section>
      <Handshake size={27} />
      <h2>Kritik ide, hargai orangnya.</h2>
      <p>
        Sampaikan argumen dengan jelas. Beri lawan bicara waktu untuk menjawab. Hindari penghinaan,
        ujaran kebencian, ancaman, diskriminasi, pelecehan, dan membagikan informasi pribadi orang
        lain.
      </p>
    </section>
    <section>
      <AudioLines size={27} />
      <h2>Bawa rasa ingin tahu.</h2>
      <p>
        Jelaskan alasan dan sumber saat menyampaikan klaim. Bedakan opini, dugaan, dan fakta. Jangan
        menyebarkan informasi yang kamu tahu keliru atau memaksa lawan bicara mengikuti pandangan
        politikmu.
      </p>
    </section>
    <section>
      <VideoOff size={27} />
      <h2>Kendali ada di tanganmu.</h2>
      <p>
        Kamera mati secara default. Gunakan mute, Next, atau Stop / Exit kapan pun kamu perlu.
        Jangan merekam, mengambil tangkapan layar, atau menyebarkan percakapan tanpa persetujuan
        semua peserta.
      </p>
    </section>
    <section>
      <ShieldCheck size={27} />
      <h2>Laporkan jika ada masalah.</h2>
      <p>
        Fitur Laporkan menyampaikan laporan kepada admin, menghentikan sesi, dan mencegah pencocokan
        kembali dengan akun tersebut. Peninjauan dilakukan secara manual; respons langsung tidak
        dijamin. Ruang ini ditujukan bagi pengguna berusia 18 tahun ke atas.
      </p>
    </section>
  </div>
  <section class="privacy">
    <LockKeyhole size={25} />
    <h2>Identitas privat, dengan batas yang jelas.</h2>
    <p>
      Kamu tidak perlu menampilkan nama asli. Supabase membuat ID akun anonim untuk antrean, sesi,
      dan pembatasan akses. Sesi login disimpan di browser. Akun admin menggunakan email dan kata
      sandi.
    </p>
    <p>
      Audio dan video dikirim menggunakan WebRTC. Aplikasi ini tidak merekam atau menyimpan
      audio/video. Koneksi langsung dapat mengungkap alamat IP kepada lawan bicara; perubahan pitch
      tidak menjamin anonimitas identitas suara. Jangan membagikan alamat, nomor telepon, dokumen,
      atau informasi sensitif lewat chat.
    </p>
    <p>
      Database menyimpan topik, metadata sesi, antrean sementara, pesan teks, sinyal koneksi, dan
      laporan untuk menjalankan layanan. Pesan dan sinyal hanya dapat diakses kedua peserta; laporan
      dapat ditinjau admin. Penyedia hosting, database, dan relay dapat memproses metadata teknis
      untuk menyediakan koneksi.
    </p>
    <p>
      Pengelola perlu mengaktifkan jadwal pembersihan data sesuai petunjuk proyek: pesan dan sinyal
      setelah 24 jam, sesi tanpa laporan setelah 7 hari, dan laporan setelah 90 hari. Hubungi
      pengelola situs untuk permintaan penghapusan data; cantumkan waktu sesi tanpa menyertakan
      informasi sensitif.
    </p>
  </section>
  <div class="guide-cta">
    <HeartHandshake size={30} />
    <div>
      <h2>Siap mendengar sisi lainnya?</h2>
      <p>Satu percakapan bisa membuka banyak hal.</p>
    </div>
    <a class="button primary" href="/#topik">Jelajahi topik <ArrowRight size={16} /></a>
  </div>
</main>
<footer class="site-footer container">
  <Logo small /><span>© {new Date().getFullYear()} Callbate · Beda suara, tetap setara.</span>
</footer>

<style>
  .guide {
    max-width: 900px;
    padding-block: 65px;
  }
  .guide > h1 {
    font-size: 43px;
    line-height: 1.25;
    letter-spacing: -1.7px;
    font-weight: 700;
    margin-top: 18px;
  }
  .intro {
    max-width: 550px;
    color: #8c9681;
    font-size: 14px;
    line-height: 1.9;
    margin-top: 23px;
  }
  .guide-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 45px;
  }
  .guide-grid section {
    border: 1px solid #e2e6d6;
    border-radius: 13px;
    background: #fffef9;
    padding: 28px;
  }
  .guide section > :global(svg) {
    color: #8da275;
  }
  .guide h2 {
    font-size: 19px;
    letter-spacing: -0.5px;
    margin-top: 18px;
  }
  .guide section p {
    font-size: 12px;
    line-height: 2;
    color: #8d9981;
    margin-top: 14px;
  }
  .privacy {
    border-top: 1px solid var(--line);
    padding-top: 35px;
    margin-top: 40px;
  }
  .privacy h2 {
    font-size: 25px;
  }
  .guide-cta {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 27px;
    background: #edf1e3;
    border-radius: 12px;
    margin-top: 40px;
  }
  .guide-cta > :global(svg) {
    color: #8ba26f;
  }
  .guide-cta h2 {
    margin-top: 0;
    font-size: 18px;
  }
  .guide-cta p {
    font-size: 11px;
    color: #99a78a;
    margin-top: 8px;
  }
  .guide-cta .button {
    margin-left: auto;
    font-size: 11px;
  }
  @media (max-width: 600px) {
    .guide {
      padding-block: 37px;
    }
    .guide > h1 {
      font-size: 33px;
    }
    .intro {
      font-size: 12px;
    }
    .guide-grid {
      grid-template-columns: 1fr;
      gap: 15px;
      margin-top: 30px;
    }
    .guide-grid section {
      padding: 24px;
    }
    .guide-cta {
      flex-wrap: wrap;
      padding: 23px;
    }
    .guide-cta .button {
      margin-left: 48px;
    }
    .guide-cta h2 {
      font-size: 15px;
    }
    .privacy h2 {
      font-size: 22px;
    }
  }
</style>
