# Callbate

Website debat politik 1 lawan 1: pilih topik → pro/kontra → antrean → voice call WebRTC. Kamera opsional dan mati secara default. UI berbahasa Indonesia, responsif, menggunakan Svelte 5, SvelteKit 3, Tailwind CSS 4, Bits UI 2, dan Lucide. Dependency dikunci melalui `package-lock.json`.

## Jalankan lokal

Gunakan **Node.js 24**.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Buka http://localhost:5173. Tanpa environment Supabase, aplikasi menyediakan **pratinjau yang diberi label**: pencarian/filter topik, pemilihan sisi, ruang call, tes mikrofon/kamera/pitch, dan CRUD admin lokal. Tidak ada lawan bicara atau pesan balasan palsu. Data topik pratinjau disimpan di localStorage browser. `/admin` menyediakan tombol pratinjau hanya ketika Supabase belum dikonfigurasi; tombol ini tidak tersedia pada lingkungan terhubung.

## Aktifkan Supabase

1. Buat proyek Supabase. Jalankan seluruh `supabase/migrations/001_callbate.sql` satu kali melalui **SQL Editor**. Migrasi membuat tabel, policy RLS, fungsi pencocokan, Realtime pesan, pembatasan laju pesan, dan enam contoh topik. Contoh topik adalah mosi diskusi, bukan feed berita otomatis.
2. Isi `.env` dengan Project URL dan **anon/publishable key** dari proyek:

   ```dotenv
   PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

   Jangan memakai `service_role` atau secret key di variabel `PUBLIC_*`. Restart dev server setelah perubahan environment.
3. Aktifkan **Anonymous Sign-Ins** melalui Authentication → Sign In / Providers. Pengguna publik memperoleh ID anonim untuk RLS; tidak perlu membuat profil. Atur rate limit Auth untuk trafik aplikasi Anda. Untuk peluncuran publik dengan trafik tinggi, integrasikan CAPTCHA Supabase/Turnstile dalam `ensureParticipant()` dan UI sebelum mengaktifkan proteksi CAPTCHA wajib.
4. Pastikan tabel `room_messages` tercantum pada publication `supabase_realtime` (sudah ditambahkan migrasi). Polling berkala juga memulihkan sinyal/pesan ketika event Realtime terlambat.
5. Pada Authentication → URL Configuration, isi Site URL dengan domain aplikasi. Tambahkan `http://localhost:5173/admin/reset` dan `https://DOMAIN_ANDA/admin/reset` ke Redirect URLs. Konfigurasikan SMTP untuk email reset di produksi.
6. Aktifkan ekstensi **pg_cron**, lalu jalankan `supabase/retention.sql`. Jadwal ini menghapus pesan/sinyal setelah 24 jam, sesi selesai tanpa laporan setelah 7 hari, dan laporan setelah 90 hari. Eksekusi setiap 15 menit. Antrean dan status panggilan ditandai kedaluwarsa setelah 90 detik tanpa heartbeat. Bersihkan akun anonim lama secara terpisah sesuai kebijakan Supabase Auth; perubahan ID anonim berarti pembatasan pasangan berbasis akun tidak lagi berlaku.

### Membuat admin

Buat pengguna permanen menggunakan Authentication → Users → **Add user**, dengan email terkonfirmasi dan kata sandi kuat. Kemudian jalankan SQL berikut, mengganti email sesuai akun tersebut:

```sql
insert into public.admin_users (user_id)
select id from auth.users
where email = 'admin@domain-anda.com'
on conflict do nothing;
```

Buka `/admin` dan login. Tidak ada kata sandi bawaan dan tidak ada pendaftaran admin publik. Peran admin tidak dapat ditambahkan dari client. RLS melindungi CRUD topik dan akses laporan di database, sehingga perlindungan tidak bergantung pada tampilan login. Dashboard memverifikasi user dan membership `admin_users`; token sesi disimpan oleh Supabase Auth di browser. Laporan dapat ditandai sudah ditinjau dan dibuka kembali. Ini adalah alur moderasi manual, tanpa moderator otomatis atau pelarangan lintas akun/perangkat.

## Panggilan dan TURN

Audio/video menggunakan WebRTC peer-to-peer, Supabase hanya menangani antrean, metadata sesi, chat, dan signaling. Vercel tidak menjalankan WebSocket server jangka panjang. Posisi pro/kontra dicocokkan secara atomik berdasarkan topik dengan advisory lock PostgreSQL. Next mengakhiri sesi lama dan menghindari pasangan sebelumnya; akun yang dilaporkan tidak dipasangkan kembali. Satu akun/browser hanya mendukung satu sesi aktif pada saat yang sama.

Untuk percobaan lokal, STUN publik Google telah disediakan. **TURN diperlukan agar panggilan andal di jaringan dengan NAT/firewall ketat**. Sediakan endpoint kredensial TURN berumur pendek, lalu isi environment **server**:

```dotenv
TURN_CREDENTIALS_URL=https://YOUR_BACKEND/turn-credentials
TURN_CREDENTIALS_TOKEN=YOUR_SERVER_TO_SERVER_TOKEN
```

Endpoint tersebut dipanggil menggunakan GET dengan header `Authorization: Bearer <TOKEN>` dan harus mengembalikan:

```json
{
  "iceServers": [
    { "urls": "stun:YOUR_TURN_HOST:3478" },
    {
      "urls": ["turn:YOUR_TURN_HOST:3478?transport=udp", "turns:YOUR_TURN_HOST:5349?transport=tcp"],
      "username": "TEMPORARY_USERNAME",
      "credential": "TEMPORARY_CREDENTIAL"
    }
  ]
}
```

Gunakan kredensial sementara dengan masa berlaku cukup untuk durasi sesi yang diinginkan (misalnya satu jam). Route `/api/ice` memvalidasi token pengguna melalui Supabase sebelum memanggil provider; secret provider tidak dikirim ke browser. Kredensial TURN sementara memang perlu diteruskan ke browser untuk WebRTC. Endpoint ini tidak otomatis menyediakan akun atau layanan TURN. Saat provider yang dikonfigurasi gagal, aplikasi menampilkan kegagalan alih-alih diam-diam menggunakan konfigurasi lain.

Pengubah pitch menggunakan AudioWorklet dua delay head dengan crossfade, rentang −6 sampai +6 semitone, tanpa mengubah kecepatan bicara. Audio hasil pemrosesan adalah track yang dikirim ke lawan bicara. Tes suara lokal harus menggunakan headphone untuk mencegah feedback. Efek pitch bukan jaminan anonimitas suara. Kamera diaktifkan hanya atas tindakan pengguna, menggunakan video transceiver yang disiapkan saat negosiasi sehingga tidak perlu memulai ulang call.

HTTPS atau localhost diperlukan untuk izin mic/camera. Alamat IP dapat diketahui oleh peer dalam koneksi langsung; aplikasi ini tidak merekam audio/video. Database tetap menyimpan pesan, sinyal, metadata, serta laporan sesuai jadwal retensi yang dikonfigurasi. Kontak pengelola spesifik perlu ditambahkan ke halaman `/panduan` sebelum peluncuran publik.

## Deploy Vercel

1. Push folder ini ke repositori Git milik Anda.
2. Import repositori ke Vercel, pilih preset **SvelteKit**, Node **24.x**.
3. Isi kedua `PUBLIC_SUPABASE_*` dan environment TURN di Settings → Environment Variables. Isi untuk Production dan Preview sesuai kebutuhan; jangan membagikan database produksi ke preview yang tidak tepercaya.
4. Build command: `npm run build`. Adapter `@sveltejs/adapter-vercel` sudah dikonfigurasi di `vite.config.ts`; output ditangani otomatis. `vercel.json` menyediakan preset dan security headers.
5. Deploy, tambahkan URL domain final ke Supabase Auth, dan uji dari dua perangkat/jaringan.

Tanpa environment, deployment tetap menampilkan mode pratinjau. Menyediakan konfigurasi tidak sama dengan melakukan deployment ke akun Anda; proyek ini belum dipublikasikan otomatis.

## Verifikasi

```powershell
npm run check
npm test
npm run build
npx playwright test
```

Tes database menjalankan migrasi PostgreSQL di PGlite dengan identitas `auth.uid()` simulasi untuk memverifikasi pro/kontra, isolasi topik, keluar/Next, RLS, dan laporan. Playwright memverifikasi UI desktop/seluler, dialog, CRUD pratinjau, dan perangkat media browser simulasi. Tes tersebut tidak menggantikan pengujian akun Supabase serta jaringan/TURN nyata.

Tes integrasi WebRTC memakai dua peer Chromium asli dengan mikrofon/kamera simulasi, migrasi PostgreSQL yang sama, dan jembatan transport lokal sebagai pengganti API Supabase. Tes memverifikasi paket audio dua arah, pengiriman chat, video opsional, Next, dan pelepasan perangkat saat keluar. Realtime sengaja tidak dipakai pada tes ini untuk menguji pemulihan signaling melalui polling.

Build lokal Windows memakai directory junction untuk output Vercel jika pembuatan symlink biasa ditolak oleh sistem. Penyesuaian di `scripts/build.mjs` terbatas pada folder `.vercel/output`; build Linux di Vercel tetap memakai perilaku adapter standar.

Uji penerimaan setelah setup: buka dua profil browser terpisah (bukan dua tab profil sama), pilih topik yang sama dan posisi berlawanan, setujui mic, verifikasi audio dua arah, chat, mute, kamera, pitch, Next, laporan, dan Exit. Ulangi dengan perangkat di jaringan seluler untuk menguji TURN. Verifikasi juga bahwa user non-admin ditolak saat mencoba mengubah tabel topik melalui Supabase.

## Struktur

- `src/routes/+page.svelte`: beranda, filter, pencarian, dialog Join.
- `src/routes/call/[topic]/+page.svelte`: ruang audio/video dan chat.
- `src/lib/room.ts`: lifecycle pencocokan, signaling WebRTC, chat, dan laporan.
- `src/lib/media.ts`, `static/audio/pitch-processor.js`: capture dan pemrosesan suara.
- `src/routes/admin/`: autentikasi dan dashboard CRUD.
- `src/routes/api/ice/`: proxy kredensial TURN terautentikasi.
- `supabase/`: schema, kebijakan akses, dan retensi.

Referensi teknis: [SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3), [Tailwind CSS](https://tailwindcss.com/docs/installation/using-vite), [Supabase Anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SvelteKit di Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit). Referensi alur interaksi: [Umingle](https://umingle.com/); desain dan aset ilustrasi aplikasi ini dibuat tersendiri.
