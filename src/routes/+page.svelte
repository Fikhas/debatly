<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowDown,
    ArrowRight,
    AudioLines,
    Check,
    ChevronDown,
    Flame,
    Headphones,
    MessageCircle,
    Mic,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    VideoOff
  } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
  import TopicArt from '#lib/components/TopicArt.svelte';
  import JoinDialog from '#lib/components/JoinDialog.svelte';
  import { categories, previewTopics, seedTopics } from '#lib/topics.ts';
  import { configured, supabase } from '#lib/supabase.ts';
  import type { Topic } from '#lib/types.ts';

  let topics = $state<Topic[]>(seedTopics);
  let category = $state('Semua topik');
  let query = $state('');
  let sort = $state('featured');
  let selected = $state<Topic | null>(null);
  let joinOpen = $state(false);
  let error = $state('');
  let loading = $state(configured);
  let hydrated = $state(false);
  let activity = $state<Record<string, number>>({});
  let filtered = $derived(
    topics
      .filter(
        (t) =>
          t.active &&
          (category === 'Semua topik' || t.category === category) &&
          `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) =>
        sort === 'newest'
          ? b.created_at.localeCompare(a.created_at)
          : Number(b.featured) - Number(a.featured)
      )
  );
  onMount(() => {
    hydrated = true;
    if (!supabase) {
      topics = previewTopics();
      return;
    }
    const client = supabase;
    async function refresh() {
      const { data, error: e } = await client
        .from('topics')
        .select('*')
        .eq('active', true)
        .order('created_at');
      if (e) error = 'Topik belum dapat dimuat. Periksa koneksi atau konfigurasi Supabase.';
      else {
        topics = data ?? [];
        error = '';
      }
      loading = false;
      const { data: counts } = await client.rpc('topic_activity');
      if (counts)
        activity = Object.fromEntries(
          counts.map((row: { topic_id: string; waiting: number }) => [row.topic_id, row.waiting])
        );
    }
    void refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  });
  function selectTopic(topic: Topic) {
    selected = topic;
    joinOpen = true;
  }
</script>

<svelte:head>
  <title>Callbate — Beda pandangan. Tetap satu obrolan.</title>
  <meta
    name="description"
    content="Ruang obrolan politik satu lawan satu. Pilih topik, tentukan posisi, dan temukan perspektif baru lewat suara. Kamera selalu opsional."
  />
</svelte:head>

<div class="site-shell">
  <header class="site-header container">
    <Logo />
    <nav aria-label="Navigasi utama">
      <a class="active" href="#topik">Jelajahi topik</a><a href="#cara-main">Cara main</a><a
        href="/panduan">Aturan main <span>↗</span></a
      >
    </nav>
    <a href="#topik" class="button dark header-cta">Mulai ngobrol <ArrowRight size={16} /></a>
  </header>

  <main>
    <section class="hero container">
      <div class="hero-copy">
        <div class="hero-badge"><span class="live-dot"></span> RUANG UNTUK BEDA PENDAPAT</div>
        <h1>
          Beda pandangan.<br />Tetap satu
          <span class="word-mark"
            >obrolan<svg viewBox="0 0 300 16" aria-hidden="true"
              ><path
                d="M3 11Q140-3 297 8M12 15Q160 2 283 13"
                stroke="currentColor"
                stroke-width="3"
                fill="none"
                stroke-linecap="round"
              /></svg
            ></span
          >.
        </h1>
        <p>
          Keluar dari lingkaran yang selalu setuju denganmu.<br class="desktop-break" /> Pilih isu, ambil
          posisi, dan dengarkan sisi lainnya.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#topik">Temukan topikmu <ArrowDown size={17} /></a><span
            class="hero-helper">Bawa argumen.<br />Bukan amarah.</span
          >
        </div>
        <div class="hero-features">
          <span><Mic size={15} /> Utamakan suara</span><span
            ><VideoOff size={16} /> Kamera opsional</span
          ><span><ShieldCheck size={16} /> Tetap anonim</span>
        </div>
      </div>
      <div class="hero-visual" aria-label="Ilustrasi dua perspektif yang saling berdialog">
        <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span>
        <div class="visual-caption"><Sparkles size={15} /> Perspektif baru dimulai di sini</div>
        <div class="debate-person person-pro">
          <div class="avatar-illustration">
            <svg viewBox="0 0 180 160" fill="none" aria-hidden="true"
              ><path d="M31 160c3-48 24-61 59-61s59 14 63 61" fill="#789582" /><path
                d="M70 95h38v32q-17 17-38 0V95Z"
                fill="#EBC3A1"
              /><ellipse cx="89" cy="65" rx="38" ry="44" fill="#F0CCAE" /><path
                d="M51 59C43 9 90-5 116 21c25 1 25 35 8 50l-7-26c-20 10-39 6-49-4L56 70l-5-11Z"
                fill="#2F4137"
              /><path
                d="M74 72h1m27 0h1"
                stroke="#37473B"
                stroke-width="5"
                stroke-linecap="round"
              /><path
                d="m88 76-3 13h7m-12 9q10 8 20-1"
                stroke="#A77861"
                stroke-width="2"
                stroke-linecap="round"
              /><path d="M49 63q-8-1-8 11t12 13m72-24q10-2 10 10t-12 14" fill="#F0CCAE" /><path
                d="M43 65C36 1 138 0 136 66M39 63v26m96-26v26"
                stroke="#284638"
                stroke-width="7"
                stroke-linecap="round"
              /><rect x="33" y="63" width="16" height="30" rx="8" fill="#486452" /><rect
                x="126"
                y="63"
                width="16"
                height="30"
                rx="8"
                fill="#486452"
              /><path d="m64 143 15 17m35-17-13 17" stroke="#577562" stroke-width="2" /></svg
            >
          </div>
          <span class="person-label"
            ><span class="live-dot"></span> Sisi pro <Check size={12} /></span
          >
        </div>
        <div class="bubble bubble-pro">“Kalau dari sudut<br />pandangku…”</div>
        <div class="debate-person person-kontra">
          <div class="avatar-illustration">
            <svg viewBox="0 0 180 160" fill="none" aria-hidden="true"
              ><path d="M45 104C18 34 56 6 86 12c48-8 66 33 48 98" fill="#493B36" /><path
                d="M23 160c4-48 26-61 67-61s60 18 67 61"
                fill="#CA8F70"
              /><path d="M72 95h36v30q-18 18-36 0V95Z" fill="#D9A47E" /><ellipse
                cx="90"
                cy="67"
                rx="36"
                ry="43"
                fill="#E6B58E"
              /><path
                d="M51 53q5-57 47-35c23-1 34 19 30 42-17-10-24-21-28-29-7 17-25 22-49 22Z"
                fill="#493B36"
              /><path
                d="M75 72h1m25 0h1"
                stroke="#493B36"
                stroke-width="5"
                stroke-linecap="round"
              /><path
                d="m88 77-3 12h7m-12 8q10 8 20-1"
                stroke="#9D6E55"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M47 63C40 2 139 1 135 65M43 63v26m91-26v26"
                stroke="#7F604A"
                stroke-width="7"
                stroke-linecap="round"
              /><rect x="36" y="63" width="16" height="30" rx="8" fill="#A37C5D" /><rect
                x="126"
                y="63"
                width="16"
                height="30"
                rx="8"
                fill="#A37C5D"
              /><path d="M66 139q25 19 48 0" stroke="#AD745A" stroke-width="2" /></svg
            >
          </div>
          <span class="person-label"
            ><span class="live-dot"></span> Sisi kontra <Check size={12} /></span
          >
        </div>
        <div class="bubble bubble-kontra">“Menarik. Tapi coba<br />lihat sisi lainnya.”</div>
        <div class="voice-bridge">
          <AudioLines size={25} /><span>Ruang temu, bukan ruang gaduh.</span>
        </div>
        <span class="visual-spark spark-one">✳</span><span class="visual-spark spark-two">+</span>
      </div>
    </section>

    <div class="values-strip">
      <div class="container values-inner">
        <span><Headphones size={19} /> Obrolan 1 lawan 1</span><span
          ><AudioLines size={19} /> Suaramu, perspektifmu</span
        ><span><ShieldCheck size={19} /> Identitas tetap privat</span><span
          ><MessageCircle size={19} /> Berdebat dengan respek</span
        >
      </div>
    </div>

    <section id="topik" class="topics-section container">
      <div class="section-heading">
        <div>
          <span class="eyebrow orange"><Flame size={14} /> BAHAN OBROLAN HARI INI</span>
          <h2>Isu besar. Mulai dari obrolan kecil.</h2>
          <p>Pilih yang bikin kamu punya pendapat. Sisi lain sudah menunggu untuk didengar.</p>
        </div>
        <span class="topic-total">{topics.filter((t) => t.active).length} topik tersedia</span>
      </div>
      {#if !configured}<div class="preview-banner">
          <span><span class="live-dot"></span> Mode pratinjau</span> Jelajahi contoh topik dan coba ruang
          debat. Panggilan langsung tersedia setelah Supabase terhubung.
        </div>{/if}
      <div class="topics-toolbar">
        <div class="category-tabs" aria-label="Kategori topik">
          {#each categories as item}<button
              disabled={!hydrated}
              class:chosen={category === item}
              onclick={() => (category = item)}>{item}</button
            >{/each}
        </div>
        <div class="topic-tools">
          <label class="search-field"
            ><Search size={17} /><input
              disabled={!hydrated}
              aria-label="Cari topik"
              bind:value={query}
              placeholder="Cari topik…"
            /></label
          ><label class="sort-control" title="Urutkan topik"
            ><SlidersHorizontal size={16} /><select
              disabled={!hydrated}
              aria-label="Urutkan topik"
              bind:value={sort}
              ><option value="featured">Pilihan</option><option value="newest">Terbaru</option
              ></select
            ><ChevronDown size={13} /></label
          >
        </div>
      </div>
      {#if error}<div class="error-box" role="alert">{error}</div>{:else if loading}<div
          class="empty-state"
        >
          <AudioLines class="pulse" size={30} />
          <h3>Memuat ruang diskusi…</h3>
        </div>{:else if filtered.length === 0}<div class="empty-state">
          <Search size={30} />
          <h3>Topiknya belum ketemu.</h3>
          <p>Coba kata kunci lain atau pilih kategori berbeda.</p>
          <button
            class="button secondary"
            onclick={() => {
              query = '';
              category = 'Semua topik';
            }}>Tampilkan semua topik</button
          >
        </div>{:else}<div class="topics-grid">
          {#each filtered as topic}<article class="topic-card">
              <div class="topic-card-art art-{topic.illustration}">
                <span class="category-tag">{topic.category}</span>{#if topic.featured}<span
                    class="featured-tag"><Flame size={12} /> Pilihan</span
                  >{/if}<TopicArt kind={topic.illustration} />
              </div>
              <div class="topic-card-content">
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <div class="topic-card-footer">
                  <span class="room-availability"
                    ><span class="live-dot"></span>{configured && activity[topic.id]
                      ? `${activity[topic.id]} mencari lawan`
                      : 'Diskusi terbuka'}</span
                  ><button
                    disabled={!hydrated}
                    class="join-button"
                    onclick={() => selectTopic(topic)}
                    aria-label={`Join: ${topic.title}`}>Join <ArrowRight size={15} /></button
                  >
                </div>
              </div>
            </article>{/each}
        </div>{/if}
      <p class="topic-note">
        <MessageCircle size={15} /> Tidak harus sepakat untuk saling memahami.
      </p>
    </section>

    <section id="cara-main" class="how-section container">
      <div class="how-heading">
        <span class="eyebrow orange">SESEDERHANA ITU</span>
        <h2>Tiga langkah.<br />Satu perspektif baru.</h2>
        <p>Tanpa profil panjang. Tanpa ribet.<br />Cukup rasa ingin tahu dan kemauan mendengar.</p>
        <a href="/panduan" class="text-link">Kenali aturan mainnya <ArrowRight size={16} /></a>
      </div>
      <div class="steps">
        <div class="step">
          <span class="step-number">01</span>
          <div>
            <h3>Pilih isu yang kamu pedulikan</h3>
            <p>Politik, ekonomi, atau isu sosial. Ada ruang untuk pendapatmu.</p>
          </div>
          <MessageCircle size={21} />
        </div>
        <div class="step">
          <span class="step-number">02</span>
          <div>
            <h3>Tentukan sisimu: pro atau kontra</h3>
            <p>Kami akan mempertemukanmu dengan perspektif yang berbeda.</p>
          </div>
          <SlidersHorizontal size={21} />
        </div>
        <div class="step">
          <span class="step-number">03</span>
          <div>
            <h3>Nyalakan mic. Buka pikiran.</h3>
            <p>Dengar, tanggapi, dan temukan sesuatu yang belum kamu pikirkan.</p>
          </div>
          <Mic size={21} />
        </div>
      </div>
    </section>

    <section class="community-section container">
      <div class="community-icon"><ShieldCheck size={31} /></div>
      <div>
        <h2>Argumennya boleh panas.<br />Obrolannya tetap berkelas.</h2>
        <p>
          Kritik gagasannya, hargai orangnya. Hindari ujaran kebencian,<br class="desktop-break" /> ancaman,
          dan informasi pribadi. Kamu selalu bisa berhenti atau melapor.
        </p>
      </div>
      <a href="/panduan" class="button secondary">Panduan komunitas <ArrowRight size={16} /></a>
    </section>
  </main>
  <footer class="site-footer container">
    <div>
      <Logo small />
      <p>Beda suara, tetap setara.</p>
    </div>
    <div class="footer-links">
      <a href="/panduan">Aturan & privasi</a><a href="/admin"
        >Dashboard admin <ArrowRight size={13} /></a
      >
    </div>
    <span>© {new Date().getFullYear()} Callbate</span>
  </footer>
</div>
<JoinDialog topic={selected} bind:open={joinOpen} />
