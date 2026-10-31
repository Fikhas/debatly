<script lang="ts">
  import { onMount } from 'svelte';
  import { Dialog } from 'bits-ui';
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleHelp,
    ExternalLink,
    Eye,
    FileText,
    Flag,
    FolderOpen,
    LayoutDashboard,
    LoaderCircle,
    LockKeyhole,
    LogOut,
    Pencil,
    Plus,
    Search,
    Settings,
    ShieldCheck,
    Sparkles,
    Trash2,
    X
  } from '@lucide/svelte';
  import Logo from '#lib/components/Logo.svelte';
  import { configured, supabase } from '#lib/supabase.ts';
  import { categories, previewTopics, savePreviewTopics } from '#lib/topics.ts';
  import type { Category, Topic } from '#lib/types.ts';

  type Report = {
    id: string;
    reason: string;
    detail: string;
    resolved: boolean;
    created_at: string;
  };
  let ready = $state(false);
  let authorized = $state(false);
  let preview = $state(false);
  let email = $state('');
  let password = $state('');
  let userEmail = $state('');
  let busy = $state(false);
  let error = $state('');
  let success = $state('');
  let topics = $state<Topic[]>([]);
  let reports = $state<Report[]>([]);
  let tab = $state('topics');
  let query = $state('');
  let status = $state('all');
  let editorOpen = $state(false);
  let deleteOpen = $state(false);
  let deleteTarget = $state<Topic | null>(null);
  let editing = $state<Topic | null>(null);
  let title = $state('');
  let description = $state('');
  let category = $state<Category>('Politik');
  let illustration = $state('building');
  let featured = $state(false);
  let active = $state(true);
  let editorError = $state('');
  let filtered = $derived(
    topics.filter(
      (t) =>
        `${t.title} ${t.category}`.toLowerCase().includes(query.toLowerCase()) &&
        (status === 'all' || (status === 'active' ? t.active : !t.active))
    )
  );
  const message = (e: unknown) =>
    e && typeof e === 'object' && 'message' in e
      ? String(e.message)
      : 'Permintaan gagal. Silakan coba lagi.';

  onMount(() => {
    let mounted = true;
    async function verify() {
      if (!supabase) {
        ready = true;
        return;
      }
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user || user.is_anonymous) {
        authorized = false;
        ready = true;
        return;
      }
      const { data, error: authError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      authorized = Boolean(data && !authError);
      if (authorized) {
        userEmail = user.email ?? '';
        await load();
      } else if (user)
        error =
          'Akun ini tidak memiliki akses admin. Hubungi pengelola untuk menambahkan peran admin.';
      ready = true;
    }
    void verify();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        authorized = false;
        topics = [];
        reports = [];
      }
    });
    return () => {
      mounted = false;
      listener?.data.subscription.unsubscribe();
    };
  });
  async function load() {
    if (preview) {
      topics = previewTopics();
      return;
    }
    if (!supabase) return;
    const [topicResult, reportResult] = await Promise.all([
      supabase.from('topics').select('*').order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('id,reason,detail,resolved,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
    ]);
    if (topicResult.error || reportResult.error)
      error = message(topicResult.error ?? reportResult.error);
    else {
      topics = topicResult.data ?? [];
      reports = reportResult.data ?? [];
    }
  }
  async function login(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    success = '';
    try {
      const { data, error: loginError } = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (loginError)
        throw new Error('Email atau kata sandi tidak sesuai. Periksa lalu coba lagi.');
      const { data: admin, error: adminError } = await supabase!
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user!.id)
        .maybeSingle();
      if (adminError || !admin) {
        await supabase!.auth.signOut();
        throw new Error('Akun ini tidak memiliki akses admin.');
      }
      authorized = true;
      userEmail = data.user!.email ?? '';
      password = '';
      await load();
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
  async function resetPassword() {
    if (!email.trim()) {
      error = 'Isi email admin terlebih dahulu untuk menerima tautan reset.';
      return;
    }
    busy = true;
    error = '';
    const { error: resetError } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset`
    });
    busy = false;
    if (resetError) error = message(resetError);
    else success = 'Jika email terdaftar, tautan reset kata sandi akan dikirim ke email tersebut.';
  }
  function openPreview() {
    preview = true;
    authorized = true;
    userEmail = 'Pratinjau lokal';
    error = '';
    void load();
  }
  async function logout() {
    if (!preview) await supabase?.auth.signOut();
    preview = false;
    authorized = false;
    topics = [];
    reports = [];
    success = '';
    error = '';
  }
  function edit(topic: Topic | null = null) {
    editing = topic;
    title = topic?.title ?? '';
    description = topic?.description ?? '';
    category = topic?.category ?? 'Politik';
    illustration = topic?.illustration ?? 'building';
    featured = topic?.featured ?? false;
    active = topic?.active ?? true;
    editorError = '';
    editorOpen = true;
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    editorError = '';
    error = '';
    success = '';
    const values = {
      title: title.trim(),
      description: description.trim(),
      category,
      illustration,
      featured,
      active
    };
    if (values.title.length < 10 || values.description.length < 10) {
      editorError = 'Judul dan deskripsi harus berisi minimal 10 karakter selain spasi.';
      busy = false;
      return;
    }
    try {
      if (preview) {
        if (editing) topics = topics.map((t) => (t.id === editing!.id ? { ...t, ...values } : t));
        else
          topics = [
            { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...values },
            ...topics
          ];
        savePreviewTopics(topics);
      } else {
        const result = editing
          ? await supabase!.from('topics').update(values).eq('id', editing.id).select('id').single()
          : await supabase!.from('topics').insert(values).select('id').single();
        if (result.error) throw result.error;
        await load();
      }
      editorOpen = false;
      success = editing ? 'Perubahan topik berhasil disimpan.' : 'Topik baru berhasil dibuat.';
    } catch (e) {
      editorError = message(e);
    } finally {
      busy = false;
    }
  }
  async function toggle(topic: Topic) {
    busy = true;
    error = '';
    success = '';
    try {
      if (preview) {
        topics = topics.map((t) => (t.id === topic.id ? { ...t, active: !t.active } : t));
        savePreviewTopics(topics);
      } else {
        const { error: e } = await supabase!
          .from('topics')
          .update({ active: !topic.active })
          .eq('id', topic.id)
          .select('id')
          .single();
        if (e) throw e;
        await load();
      }
      success = topic.active
        ? 'Topik dinonaktifkan dari beranda.'
        : 'Topik dipublikasikan di beranda.';
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    busy = true;
    error = '';
    try {
      if (preview) {
        topics = topics.filter((t) => t.id !== deleteTarget!.id);
        savePreviewTopics(topics);
      } else {
        const { error: e } = await supabase!
          .from('topics')
          .delete()
          .eq('id', deleteTarget.id)
          .select('id')
          .single();
        if (e) throw e;
        await load();
      }
      deleteOpen = false;
      success = 'Topik berhasil dihapus.';
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
  async function resolve(report: Report) {
    busy = true;
    error = '';
    const { error: e } = await supabase!
      .from('reports')
      .update({ resolved: !report.resolved })
      .eq('id', report.id)
      .select('id')
      .single();
    if (e) error = message(e);
    else {
      await load();
      success = 'Status laporan diperbarui.';
    }
    busy = false;
  }
</script>

<svelte:head
  ><title>Dashboard admin · debatly.</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>

{#if !ready}<div class="admin-loading">
    <LoaderCircle class="pulse" size={30} />
    <p>Memeriksa sesi admin…</p>
  </div>{:else if !authorized}
  <div class="login-page">
    <header class="container">
      <Logo /><a href="/" class="text-link"><ArrowLeft size={15} /> Kembali ke beranda</a>
    </header>
    <main class="login-card">
      <span class="login-icon"><LockKeyhole size={26} /></span><span class="eyebrow orange"
        >DI BALIK RUANG TEMU</span
      >
      <h1>Halo, pengelola.</h1>
      <p>Kelola topik yang membuka percakapan baru.</p>
      {#if configured}<form onsubmit={login}>
          <label class="field"
            >Email admin<input
              type="email"
              bind:value={email}
              required
              autocomplete="username"
              placeholder="admin@domain.com"
            /></label
          ><label class="field"
            >Kata sandi<input
              type="password"
              bind:value={password}
              required
              autocomplete="current-password"
              placeholder="Masukkan kata sandi"
            /></label
          >{#if error}<div class="error-box" role="alert">{error}</div>{/if}{#if success}<div
              class="success-box"
              role="status"
            >
              {success}
            </div>{/if}<button class="button primary full" disabled={busy}
            >{busy ? 'Memeriksa akses…' : 'Masuk dashboard'}<ArrowRight size={16} /></button
          ><button type="button" class="forgot-button" onclick={resetPassword} disabled={busy}
            >Lupa kata sandi?</button
          >
        </form>{:else}<div class="notice">
          Supabase belum dikonfigurasi. Login admin akan aktif setelah kamu mengisi environment dan
          menjalankan migrasi database.
        </div>
        <button class="button primary full" onclick={openPreview}
          >Buka pratinjau dashboard <ArrowRight size={16} /></button
        >
        <p class="preview-explanation">
          Perubahan pratinjau disimpan hanya di browser ini. Tidak menggunakan akun atau data
          produksi.
        </p>{/if}
      <div class="login-footnote">
        <ShieldCheck size={14} /> Akses terbatas untuk admin terdaftar
      </div>
    </main>
    <p class="login-bottom">Match dulu, debat kemudian</p>
  </div>
{:else}
  <div class="admin-page">
    <aside class="admin-sidebar">
      <Logo />
      <div class="workspace-label">RUANG PENGELOLA</div>
      <nav aria-label="Dashboard admin">
        <button
          class:selected={tab === 'topics'}
          onclick={() => {
            tab = 'topics';
            error = '';
            success = '';
          }}><LayoutDashboard size={18} /> Kelola topik <span>{topics.length}</span></button
        ><button
          class:selected={tab === 'reports'}
          onclick={() => {
            tab = 'reports';
            error = '';
            success = '';
          }}
          ><Flag size={18} /> Laporan pengguna {#if reports.some((r) => !r.resolved)}<span
              >{reports.filter((r) => !r.resolved).length}</span
            >{/if}</button
        ><button class:selected={tab === 'settings'} onclick={() => (tab = 'settings')}
          ><Settings size={18} /> Konfigurasi</button
        >
      </nav>
      <div class="sidebar-help">
        <ShieldCheck size={22} /><strong>Ruang yang sehat<br />dimulai dari pengelolaan.</strong>
        <p>Jaga topik tetap seimbang dan tinjau laporan secara berkala.</p>
        <a href="/panduan">Panduan komunitas <ArrowRight size={13} /></a>
      </div>
      <div class="sidebar-bottom">
        <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Lihat website</a
        ><button onclick={logout}><LogOut size={15} /> Keluar dashboard</button>
      </div>
    </aside>
    <div class="admin-content">
      <header class="admin-topbar">
        <span
          >Dashboard <ChevronRight size={13} />
          <strong
            >{tab === 'topics'
              ? 'Kelola topik'
              : tab === 'reports'
                ? 'Laporan pengguna'
                : 'Konfigurasi'}</strong
          ></span
        >
        <div class="admin-user">
          <span>A</span>
          <div><strong>Administrator</strong><small>{userEmail}</small></div>
        </div>
      </header>
      <main class="admin-main">
        {#if preview}<div class="preview-banner">
            <span><span class="live-dot"></span> Pratinjau lokal</span> CRUD dapat dicoba. Data tersimpan
            di browser ini dan akan terlihat di beranda pratinjau.
          </div>{/if}
        <div class="admin-heading">
          <div>
            <span class="eyebrow orange"
              >{tab === 'topics'
                ? 'BUKA PERCAKAPAN BARU'
                : tab === 'reports'
                  ? 'DENGARKAN KOMUNITAS'
                  : 'SIAP UNTUK MENGUDARA'}</span
            >
            <h1>
              {tab === 'topics'
                ? 'Kelola topik diskusi'
                : tab === 'reports'
                  ? 'Laporan pengguna'
                  : 'Konfigurasi aplikasi'}
            </h1>
            <p>
              {tab === 'topics'
                ? 'Pilih isu yang relevan. Beri ruang untuk kedua sisi.'
                : tab === 'reports'
                  ? 'Tinjau laporan dan tandai setelah ditindaklanjuti.'
                  : 'Status koneksi dan langkah penyiapan lingkungan produksi.'}
            </p>
          </div>
          {#if tab === 'topics'}<button class="button primary" onclick={() => edit()}
              ><Plus size={17} /> Tambah topik</button
            >{/if}
        </div>
        {#if success}<div class="success-box" role="status">{success}</div>{/if}{#if error}<div
            class="error-box"
            role="alert"
          >
            {error}
          </div>{/if}
        {#if tab === 'topics'}
          <div class="admin-stats">
            <div>
              <span class="stat-icon"><FolderOpen size={20} /></span>
              <div><span>Total topik</span><strong>{topics.length}</strong></div>
              <small>Semua ruang percakapan</small>
            </div>
            <div>
              <span class="stat-icon green"><CheckCircle2 size={20} /></span>
              <div>
                <span>Topik aktif</span><strong>{topics.filter((t) => t.active).length}</strong>
              </div>
              <small>Tampil di halaman beranda</small>
            </div>
            <div>
              <span class="stat-icon orange"><FileText size={20} /></span>
              <div>
                <span>Nonaktif</span><strong>{topics.filter((t) => !t.active).length}</strong>
              </div>
              <small>Disimpan untuk nanti</small>
            </div>
          </div>
          <section class="admin-table-panel">
            <div class="table-toolbar">
              <div>
                <h2>Semua topik <span>{filtered.length}</span></h2>
                <p>Kelola mosi, kategori, dan status publikasi.</p>
              </div>
              <div class="table-filters">
                <label class="search-field"
                  ><Search size={16} /><input
                    bind:value={query}
                    placeholder="Cari topik…"
                    aria-label="Cari topik admin"
                  /></label
                ><select bind:value={status} aria-label="Filter status"
                  ><option value="all">Semua status</option><option value="active">Aktif</option
                  ><option value="inactive">Nonaktif</option></select
                >
              </div>
            </div>
            <div class="table-scroll">
              <table>
                <thead
                  ><tr
                    ><th>TOPIK DISKUSI</th><th>KATEGORI</th><th>STATUS</th><th>TANGGAL</th><th
                      class="action-column">AKSI</th
                    ></tr
                  ></thead
                ><tbody
                  >{#each filtered as topic}<tr
                      ><td
                        ><div class="table-topic">
                          <span class="topic-table-icon art-{topic.illustration}"
                            ><FileText size={20} /></span
                          >
                          <div>
                            <strong>{topic.title}</strong>
                            <p>{topic.description}</p>
                            {#if topic.featured}<span class="table-featured"
                                ><Sparkles size={10} /> Topik pilihan</span
                              >{/if}
                          </div>
                        </div></td
                      ><td><span class="table-category">{topic.category}</span></td><td
                        ><button
                          class="status-pill"
                          class:is-active={topic.active}
                          onclick={() => toggle(topic)}
                          disabled={busy}
                          title="Klik untuk mengubah status"
                          ><span class="live-dot"></span>{topic.active
                            ? 'Aktif'
                            : 'Nonaktif'}</button
                        ></td
                      ><td class="date-cell"
                        >{new Date(topic.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}</td
                      ><td
                        ><div class="row-actions">
                          <button
                            aria-label={`Edit ${topic.title}`}
                            title="Edit topik"
                            onclick={() => edit(topic)}
                            disabled={busy}><Pencil size={15} /></button
                          ><button
                            aria-label={`Hapus ${topic.title}`}
                            title="Hapus topik"
                            class="delete-action"
                            onclick={() => {
                              deleteTarget = topic;
                              deleteOpen = true;
                            }}
                            disabled={busy}><Trash2 size={15} /></button
                          >
                        </div></td
                      ></tr
                    >{/each}{#if !filtered.length}<tr
                      ><td colspan="5"
                        ><div class="empty-state compact">
                          <Search size={24} />
                          <h3>Belum ada topik yang sesuai.</h3>
                          <p>Ubah pencarian atau tambahkan topik baru.</p>
                        </div></td
                      ></tr
                    >{/if}</tbody
                >
              </table>
            </div>
            <div class="table-bottom">
              Menampilkan {filtered.length} dari {topics.length} topik<span
                ><ShieldCheck size={12} /> Perubahan tersimpan {preview
                  ? 'di browser'
                  : 'di database'}</span
              >
            </div>
          </section>
        {:else if tab === 'reports'}
          <section class="admin-table-panel report-list">
            <div class="table-toolbar">
              <div>
                <h2>
                  Laporan masuk <span
                    >{reports.filter((r) => !r.resolved).length} belum ditinjau</span
                  >
                </h2>
                <p>
                  Menampilkan maksimal 200 laporan terbaru. Penanganan dilakukan secara manual oleh
                  admin.
                </p>
              </div>
              <button class="button secondary small" onclick={load}>Muat ulang</button>
            </div>
            {#if !reports.length}<div class="empty-state compact">
                <ShieldCheck size={34} />
                <h3>{preview ? 'Pratinjau laporan pengguna' : 'Belum ada laporan masuk.'}</h3>
                <p>
                  {preview
                    ? 'Laporan nyata akan muncul setelah Supabase terhubung dan pengguna mengirim laporan dari ruang call.'
                    : 'Laporan dari peserta akan muncul di sini.'}
                </p>
              </div>{/if}{#each reports as report}<article class="report-card">
                <div>
                  <span class="status-pill" class:is-active={report.resolved}
                    >{report.resolved ? 'Ditinjau' : 'Perlu ditinjau'}</span
                  ><time>{new Date(report.created_at).toLocaleString('id-ID')}</time>
                </div>
                <h3>{report.reason}</h3>
                <p>{report.detail || 'Tidak ada detail tambahan.'}</p>
                <button
                  class="button secondary small"
                  onclick={() => resolve(report)}
                  disabled={busy}
                  ><Check size={14} />{report.resolved
                    ? 'Buka kembali'
                    : 'Tandai sudah ditinjau'}</button
                >
              </article>{/each}
          </section>
        {:else}
          <section class="setup-grid">
            <div class="setup-card">
              <span class="stat-icon green"><ShieldCheck size={23} /></span>
              <h2>Supabase</h2>
              <p>
                {configured
                  ? 'Environment Supabase sudah diisi. Data dashboard dibaca melalui kebijakan akses database.'
                  : 'Belum terhubung. Isi PUBLIC_SUPABASE_URL dan PUBLIC_SUPABASE_ANON_KEY di environment.'}
              </p>
              <span class="status-pill" class:is-active={configured}
                >{configured ? 'Dikonfigurasi' : 'Mode pratinjau'}</span
              >
            </div>
            <div class="setup-card">
              <span class="stat-icon orange"><ExternalLink size={23} /></span>
              <h2>Vercel</h2>
              <p>
                Adapter Vercel sudah terpasang. Import repositori, isi environment, lalu deploy
                menggunakan preset SvelteKit dan Node 24.
              </p>
              <a href="https://vercel.com/new" target="_blank" rel="noreferrer" class="text-link"
                >Buka Vercel <ArrowRight size={15} /></a
              >
            </div>
            <div class="setup-card wide">
              <h2>Langkah aktivasi</h2>
              <ol>
                <li>
                  Jalankan <code>supabase/migrations/001_callbate.sql</code> di SQL Editor Supabase.
                </li>
                <li>Aktifkan Anonymous Sign-Ins pada Authentication → Sign In / Providers.</li>
                <li>
                  Buat akun admin melalui Supabase, lalu tambahkan UUID-nya ke tabel <code
                    >admin_users</code
                  >.
                </li>
                <li>Konfigurasikan URL aplikasi dan redirect password reset di Supabase Auth.</li>
                <li>
                  Hubungkan penyedia TURN lewat environment server agar panggilan dapat menjangkau
                  jaringan dengan NAT ketat.
                </li>
              </ol>
              <p>
                Lihat README di folder proyek untuk SQL penambahan admin, retensi data, dan
                pengujian dua browser.
              </p>
            </div>
          </section>
        {/if}
        <footer class="admin-footer">
          debatly. · Ruang pengelola <span>Bangun percakapan yang berarti.</span>
        </footer>
      </main>
    </div>
  </div>
{/if}

<Dialog.Root bind:open={editorOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class="modal-overlay" /><Dialog.Content class="modal topic-editor"
      ><Dialog.Close class="close-button" aria-label="Tutup editor" disabled={busy}
        ><X size={18} /></Dialog.Close
      ><span class="eyebrow orange">RUANG UNTUK ISU BARU</span><Dialog.Title class="modal-title"
        >{editing ? 'Edit topik diskusi' : 'Tambah topik diskusi'}</Dialog.Title
      ><Dialog.Description class="modal-description"
        >Tulis mosi yang jelas dan memberi ruang untuk pro maupun kontra.</Dialog.Description
      >
      <form onsubmit={save}>
        <label class="field"
          >Judul / mosi diskusi<input
            bind:value={title}
            required
            minlength="10"
            maxlength="160"
            placeholder="Contoh: Transportasi publik sebaiknya gratis?"
          /><small>{title.length}/160 karakter</small></label
        ><label class="field"
          >Deskripsi<textarea
            bind:value={description}
            required
            minlength="10"
            maxlength="350"
            placeholder="Berikan konteks singkat dan seimbang."></textarea><small
            >{description.length}/350 karakter</small
          ></label
        >
        <div class="form-row">
          <label class="field"
            >Kategori<select bind:value={category}
              >{#each categories.slice(1) as cat}<option value={cat}>{cat}</option>{/each}</select
            ></label
          ><label class="field"
            >Ilustrasi<select bind:value={illustration}
              ><option value="building">Pemerintahan</option><option value="meal"
                >Makanan & kebijakan</option
              ><option value="chart">Ekonomi</option><option value="energy"
                >Energi & lingkungan</option
              ><option value="phone">Teknologi & sosial</option><option value="scales"
                >Hukum & keadilan</option
              ></select
            ></label
          >
        </div>
        <div class="editor-checks">
          <label><input type="checkbox" bind:checked={active} /> Publikasikan topik</label><label
            ><input type="checkbox" bind:checked={featured} /> Jadikan topik pilihan</label
          >
        </div>
        {#if editorError}<div class="error-box" role="alert">{editorError}</div>{/if}
        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            onclick={() => (editorOpen = false)}
            disabled={busy}>Batal</button
          ><button class="button primary" disabled={busy}
            >{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Buat topik'}<Check
              size={16}
            /></button
          >
        </div>
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>
<Dialog.Root bind:open={deleteOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class="modal-overlay" /><Dialog.Content class="modal"
      ><Dialog.Title class="modal-title">Hapus topik ini?</Dialog.Title><Dialog.Description
        class="modal-description"
        >“{deleteTarget?.title}” akan dihapus dari daftar topik. Tindakan ini tidak dapat
        dibatalkan. Kamu juga bisa memilih nonaktifkan untuk menyimpan topik.</Dialog.Description
      >{#if error}<div class="error-box">{error}</div>{/if}
      <div class="form-actions">
        <button class="button secondary" onclick={() => (deleteOpen = false)} disabled={busy}
          >Batal</button
        ><button class="button danger" onclick={remove} disabled={busy}
          ><Trash2 size={16} />{busy ? 'Menghapus…' : 'Hapus topik'}</button
        >
      </div></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>

<style>
  .admin-loading {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: #91a17e;
    font-size: 13px;
  }
  .login-page {
    min-height: 100dvh;
    background: radial-gradient(ellipse at 50% 30%, #f0f0e5, transparent 60%);
  }
  .login-page header {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .login-page header .text-link {
    margin: 0;
    color: #929a87;
    font-weight: 400;
  }
  .login-card {
    max-width: 430px;
    width: calc(100% - 36px);
    margin: 55px auto 20px;
    background: #fffef9;
    border: 1px solid #e3e7d8;
    border-radius: 20px;
    padding: 35px 38px;
    box-shadow: 0 20px 80px #293d2405;
  }
  .login-icon {
    display: grid;
    place-items: center;
    width: 57px;
    height: 57px;
    background: #eff2e7;
    border: 1px solid #e2e9d6;
    color: #7f946b;
    border-radius: 15px;
    margin-bottom: 25px;
  }
  .login-card h1 {
    font-size: 31px;
    letter-spacing: -1px;
    font-weight: 700;
    margin: 12px 0;
  }
  .login-card > p {
    font-size: 12px;
    color: #98a18c;
    line-height: 1.8;
    margin-bottom: 27px;
  }
  .login-card .field {
    margin-block: 20px;
  }
  .login-card .button {
    margin-top: 8px;
  }
  .login-footnote {
    display: flex;
    gap: 7px;
    align-items: center;
    justify-content: center;
    border-top: 1px solid var(--line);
    padding-top: 22px;
    margin-top: 22px;
    color: #9da68f;
    font-size: 9px;
  }
  .login-card p.preview-explanation {
    font-size: 10px;
    text-align: center;
    line-height: 1.9;
    margin: 16px 0 0;
  }
  .login-bottom {
    text-align: center;
    font-size: 10px;
    color: #a6ad9a;
    padding: 18px;
  }
  .forgot-button {
    display: block;
    margin: 18px auto 0;
    background: transparent;
    color: #8e9c7f;
    font-size: 11px;
  }
  .admin-page {
    display: flex;
    min-height: 100dvh;
    background: #f4f5ef;
  }
  .admin-sidebar {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid #e1e6d6;
    background: #fafbf5;
    position: fixed;
    height: 100dvh;
    padding: 33px 24px;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }
  .workspace-label {
    font-size: 8px;
    letter-spacing: 1.8px;
    color: #a5ae97;
    margin-top: 40px;
    margin-left: 10px;
  }
  .admin-sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 17px;
  }
  .admin-sidebar nav button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 12px;
    color: #99a28e;
    font-size: 11px;
    font-weight: 500;
    border-radius: 8px;
    background: transparent;
    text-align: left;
  }
  .admin-sidebar nav .selected {
    background: #e9efdf;
    color: #5c764b;
  }
  .admin-sidebar nav button > span {
    font-size: 9px;
    margin-left: auto;
    background: #dce6ce;
    border-radius: 4px;
    padding: 2px 5px;
    color: #799060;
  }
  .sidebar-help {
    margin-top: auto;
    margin-bottom: 30px;
    border: 1px solid #e4e9d9;
    padding: 17px;
    border-radius: 11px;
    background: #f0f4e8;
    color: #8fa17c;
  }
  .sidebar-help strong {
    display: block;
    font-size: 12px;
    line-height: 1.8;
    color: #6e815b;
    font-weight: 550;
    margin-top: 12px;
  }
  .sidebar-help p {
    font-size: 10px;
    line-height: 1.9;
    margin-top: 8px;
    color: #a1ac91;
  }
  .sidebar-help a {
    display: flex;
    gap: 8px;
    font-size: 9px;
    align-items: center;
    margin-top: 14px;
    color: #7f9569;
  }
  .sidebar-bottom {
    display: flex;
    flex-direction: column;
    gap: 18px;
    border-top: 1px solid #e4e8da;
    padding: 22px 9px 0;
  }
  .sidebar-bottom a,
  .sidebar-bottom button {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 10px;
    color: #99a48c;
    background: transparent;
    text-align: left;
  }
  .sidebar-bottom button {
    color: #b18d75;
  }
  .admin-content {
    margin-left: 240px;
    flex: 1;
    min-width: 0;
  }
  .admin-topbar {
    height: 85px;
    border-bottom: 1px solid #e3e8d9;
    padding: 0 38px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fcfcf7;
  }
  .admin-topbar > span {
    display: flex;
    gap: 12px;
    align-items: center;
    color: #a2ab97;
    font-size: 10px;
  }
  .admin-topbar strong {
    font-weight: 550;
    color: #75856a;
  }
  .admin-user {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .admin-user > span {
    width: 33px;
    height: 33px;
    display: grid;
    place-items: center;
    border: 1px solid #dae4cd;
    background: #e9efdf;
    border-radius: 50%;
    font-size: 12px;
    color: #7f936c;
  }
  .admin-user strong {
    font-size: 10px;
    display: block;
  }
  .admin-user small {
    font-size: 8px;
    color: #a1ac94;
    display: block;
    margin-top: 4px;
  }
  .admin-main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 14px 38px 30px;
  }
  .admin-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin: 34px 0 30px;
  }
  .admin-heading h1 {
    font-size: 29px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-top: 11px;
  }
  .admin-heading p {
    font-size: 11px;
    line-height: 1.8;
    color: #97a28b;
    margin-top: 10px;
  }
  .admin-heading .button {
    font-size: 11px;
  }
  .admin-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-bottom: 27px;
  }
  .admin-stats > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 15px;
    border: 1px solid #e1e7d5;
    background: #fffef9;
    padding: 21px;
    border-radius: 12px;
  }
  .stat-icon {
    display: grid;
    place-items: center;
    width: 43px;
    height: 43px;
    background: #eeecf4;
    color: #9684a6;
    border: 1px solid #e7e3ef;
    border-radius: 11px;
  }
  .stat-icon.green {
    background: #eaf0e2;
    color: #8b9f76;
    border-color: #e1e9d6;
  }
  .stat-icon.orange {
    background: #f7eee2;
    color: #ba9b72;
    border-color: #efe5d6;
  }
  .admin-stats > div > div > span {
    font-size: 10px;
    color: #9ba58e;
    display: block;
  }
  .admin-stats strong {
    font-size: 25px;
    font-weight: 650;
    line-height: 1.3;
    display: block;
    margin-top: 4px;
  }
  .admin-stats small {
    flex-basis: 100%;
    font-size: 8px;
    color: #a6b099;
    border-top: 1px solid #edf0e6;
    padding-top: 12px;
    margin-top: 3px;
  }
  .admin-table-panel {
    background: #fffef9;
    border: 1px solid #e0e6d4;
    border-radius: 12px;
    overflow: hidden;
  }
  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    padding: 23px;
  }
  .table-toolbar h2 {
    font-size: 14px;
    letter-spacing: -0.2px;
  }
  .table-toolbar h2 > span {
    font-size: 9px;
    color: #93a180;
    vertical-align: middle;
    background: #f0f3e8;
    padding: 3px 6px;
    border-radius: 4px;
    margin-left: 5px;
  }
  .table-toolbar p {
    font-size: 9px;
    color: #a4ae96;
    margin-top: 6px;
    line-height: 1.8;
  }
  .table-filters {
    display: flex;
    gap: 8px;
  }
  .table-filters input {
    width: 130px;
  }
  .table-filters > select {
    font-size: 10px;
    color: #8f9c7e;
    border: 1px solid #e0e6d5;
    border-radius: 7px;
    background: #fffef9;
    padding: 8px 10px;
  }
  .table-scroll {
    overflow: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 680px;
    text-align: left;
  }
  th {
    font-size: 8px;
    letter-spacing: 1px;
    color: #a2ad94;
    background: #f7f8f1;
    padding: 14px 20px;
    font-weight: 550;
    border-block: 1px solid #e8edde;
  }
  td {
    padding: 21px 20px;
    border-bottom: 1px solid #edf0e5;
    vertical-align: middle;
  }
  th:first-child {
    width: 47%;
  }
  .table-topic {
    display: flex;
    gap: 13px;
    align-items: start;
  }
  .topic-table-icon {
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    border-radius: 9px;
    flex-shrink: 0;
    background: #eaf0e1;
    color: #8ca078;
  }
  .table-topic strong {
    font-size: 11px;
    font-weight: 550;
    line-height: 1.7;
    display: block;
    max-width: 330px;
  }
  .table-topic p {
    font-size: 9px;
    color: #a8b09b;
    line-height: 1.8;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 5px;
  }
  .table-featured {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 8px;
    color: #bb9d79;
    margin-top: 7px;
  }
  .table-category {
    padding: 5px 8px;
    background: #f2f3ec;
    border: 1px solid #e7eadf;
    color: #8f9d80;
    font-size: 8px;
    white-space: nowrap;
    border-radius: 4px;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    background: #f1f1eb;
    color: #a5aa9a;
    font-size: 9px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .status-pill .live-dot {
    width: 4px;
    height: 4px;
    background: #b9bfad;
  }
  .status-pill.is-active {
    background: #eef3e6;
    color: #809869;
  }
  .status-pill.is-active .live-dot {
    background: #93a97d;
  }
  .date-cell {
    font-size: 9px;
    color: #a4af95;
    white-space: nowrap;
  }
  .row-actions {
    display: flex;
    gap: 10px;
  }
  .row-actions button {
    background: transparent;
    color: #9baa8b;
    padding: 4px;
  }
  .row-actions button:hover {
    color: #637e4e;
  }
  .row-actions .delete-action {
    color: #bea28c;
  }
  .table-bottom {
    font-size: 9px;
    color: #a9b29d;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 23px;
  }
  .table-bottom > span {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .admin-footer {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #a9b39b;
    margin-top: 26px;
  }
  .editor-checks {
    display: flex;
    gap: 22px;
    font-size: 11px;
    color: #8b987c;
    margin-top: 20px;
  }
  .editor-checks label {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .editor-checks input {
    accent-color: #7c9566;
  }
  .topic-editor {
    width: min(580px, calc(100% - 32px));
  }
  .report-card {
    padding: 24px;
    border-top: 1px solid #e8edde;
  }
  .report-card > div {
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .report-card time {
    color: #a3ad96;
    font-size: 9px;
  }
  .report-card h3 {
    font-size: 15px;
    margin-top: 14px;
  }
  .report-card p {
    font-size: 12px;
    line-height: 1.8;
    margin: 10px 0 17px;
    color: #909e7f;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .setup-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .setup-card {
    background: #fffef9;
    border: 1px solid #e0e6d4;
    border-radius: 12px;
    padding: 26px;
  }
  .setup-card h2 {
    font-size: 18px;
    letter-spacing: -0.4px;
    margin: 16px 0 12px;
  }
  .setup-card p {
    font-size: 11px;
    line-height: 1.9;
    color: #98a38b;
    margin-bottom: 16px;
  }
  .setup-card.wide {
    grid-column: 1/-1;
  }
  .setup-card.wide h2 {
    margin-top: 0;
  }
  .setup-card ol {
    padding-left: 19px;
    font-size: 12px;
    line-height: 2.3;
    color: #899b78;
    margin-bottom: 18px;
  }
  .setup-card code {
    font-size: 10px;
    background: #f0f3e8;
    padding: 2px 4px;
    border-radius: 4px;
    overflow-wrap: anywhere;
  }
  @media (max-width: 1100px) {
    .admin-sidebar {
      width: 205px;
      padding: 27px 17px;
    }
    .admin-sidebar :global(.brand) {
      font-size: 25px;
    }
    .admin-content {
      margin-left: 205px;
    }
    .admin-main {
      padding: 10px 23px 25px;
    }
    .admin-topbar {
      padding: 0 23px;
    }
    .admin-heading h1 {
      font-size: 25px;
    }
    .admin-stats {
      gap: 12px;
    }
    .admin-stats > div {
      padding: 16px;
      gap: 12px;
    }
    .table-toolbar {
      align-items: start;
      flex-direction: column;
    }
    .table-filters {
      width: 100%;
    }
    .table-filters .search-field {
      flex: 1;
    }
    .table-filters input {
      width: 100%;
    }
  }
  @media (max-width: 760px) {
    .admin-sidebar {
      width: 100%;
      height: auto;
      position: static;
      padding: 18px;
      border-right: 0;
      border-bottom: 1px solid #dfe6d2;
    }
    .admin-page {
      flex-direction: column;
    }
    .admin-sidebar :global(.brand) {
      align-self: start;
    }
    .workspace-label,
    .sidebar-help {
      display: none;
    }
    .admin-sidebar nav {
      flex-direction: row;
      gap: 5px;
      margin-top: 20px;
      overflow: auto;
    }
    .admin-sidebar nav button {
      white-space: nowrap;
      font-size: 10px;
      gap: 7px;
      padding: 10px;
    }
    .admin-sidebar nav button :global(svg) {
      width: 15px;
    }
    .sidebar-bottom {
      position: absolute;
      right: 20px;
      top: 22px;
      padding: 0;
      border: 0;
      gap: 0;
    }
    .sidebar-bottom > a {
      display: none;
    }
    .sidebar-bottom > button {
      font-size: 9px;
    }
    .admin-content {
      margin: 0;
    }
    .admin-topbar {
      height: 65px;
      padding: 0 19px;
    }
    .admin-topbar > span {
      font-size: 9px;
      gap: 7px;
    }
    .admin-user > div {
      display: none;
    }
    .admin-main {
      padding: 0 17px 25px;
    }
    .admin-heading {
      margin-top: 27px;
      align-items: start;
    }
    .admin-heading h1 {
      font-size: 23px;
    }
    .admin-heading .eyebrow {
      font-size: 7px;
    }
    .admin-heading .button {
      font-size: 9px;
      padding: 11px 12px;
      gap: 7px;
      min-height: 38px;
    }
    .admin-heading .button :global(svg) {
      width: 14px;
    }
    .admin-heading p {
      font-size: 10px;
    }
    .admin-stats {
      gap: 8px;
      margin-bottom: 20px;
    }
    .admin-stats > div {
      padding: 12px;
      gap: 9px;
      align-items: start;
    }
    .admin-stats .stat-icon {
      width: 29px;
      height: 29px;
      border-radius: 7px;
    }
    .admin-stats .stat-icon :global(svg) {
      width: 15px;
    }
    .admin-stats > div > div > span {
      font-size: 8px;
    }
    .admin-stats strong {
      font-size: 22px;
    }
    .admin-stats small {
      font-size: 7px;
      line-height: 1.7;
    }
    .table-toolbar {
      padding: 18px;
    }
    .table-bottom {
      padding: 15px 18px;
      font-size: 8px;
    }
    .table-bottom > span {
      display: none;
    }
    .setup-grid {
      grid-template-columns: 1fr;
    }
    .setup-card.wide {
      grid-column: auto;
    }
    .setup-card {
      padding: 20px;
    }
    .setup-card ol {
      font-size: 11px;
      line-height: 2.2;
    }
    .admin-footer {
      font-size: 7px;
      gap: 20px;
    }
    .login-card {
      padding: 28px;
      margin-top: 25px;
    }
    .login-page header {
      height: 83px;
    }
    .login-page header .text-link {
      font-size: 9px;
    }
    .login-page header .text-link :global(svg) {
      width: 12px;
    }
    .editor-checks {
      gap: 13px;
      font-size: 10px;
    }
    .form-row {
      gap: 11px;
    }
    .form-row .field {
      font-size: 11px;
    }
    .form-row select {
      font-size: 11px;
    }
  }
</style>
