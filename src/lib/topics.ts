import type { Topic } from './types';

// Contoh mosi untuk pratinjau, bukan klaim berita terkini.
export const seedTopics: Topic[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Makan bergizi gratis: investasi atau beban anggaran?',
    description: 'Antara masa depan generasi muda dan prioritas belanja negara. Kamu di sisi mana?',
    category: 'Politik',
    illustration: 'meal',
    featured: true,
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    title: 'Pajak naik, kesejahteraan ikut naik?',
    description: 'Menimbang kontribusi publik dan dampaknya pada daya beli masyarakat.',
    category: 'Ekonomi',
    illustration: 'chart',
    featured: false,
    active: true,
    created_at: '2026-01-02T00:00:00Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    title: 'Politik dinasti: hak demokrasi atau ancaman?',
    description: 'Setiap warga berhak dipilih. Tapi di mana batas keadilan dalam kompetisi?',
    category: 'Politik',
    illustration: 'building',
    featured: true,
    active: true,
    created_at: '2026-01-03T00:00:00Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    title: 'Transisi energi harus dipercepat, berapa pun biayanya?',
    description: 'Krisis iklim, lapangan kerja, dan harga energi. Mari cari titik temunya.',
    category: 'Lingkungan',
    illustration: 'energy',
    featured: false,
    active: true,
    created_at: '2026-01-04T00:00:00Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    title: 'Media sosial perlu dibatasi untuk anak di bawah 16 tahun?',
    description: 'Melindungi generasi digital tanpa menutup ruang berekspresi.',
    category: 'Sosial',
    illustration: 'phone',
    featured: false,
    active: true,
    created_at: '2026-01-05T00:00:00Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    title: 'Hukuman koruptor sudah cukup memberi efek jera?',
    description: 'Membicarakan keadilan, pemulihan aset, dan kepercayaan kepada hukum.',
    category: 'Hukum',
    illustration: 'scales',
    featured: false,
    active: true,
    created_at: '2026-01-06T00:00:00Z'
  }
];

export const categories = [
  'Semua topik',
  'Politik',
  'Ekonomi',
  'Sosial',
  'Lingkungan',
  'Hukum'
] as const;
const storageKey = 'callbate.preview.topics.v1';
export function previewTopics(): Topic[] {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : structuredClone(seedTopics);
  } catch {
    return structuredClone(seedTopics);
  }
}
export function savePreviewTopics(topics: Topic[]) {
  localStorage.setItem(storageKey, JSON.stringify(topics));
}
