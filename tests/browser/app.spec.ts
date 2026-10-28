import { expect, test } from '@playwright/test';

test('home categories, search, accessible join flow and local media', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['microphone', 'camera']);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Beda pandangan.');
  await expect(page.locator('.topic-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Ekonomi', exact: true }).click();
  await expect(page.locator('.topic-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Semua topik', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cari topik', exact: true }).fill('tidak-ada-topik');
  await expect(page.getByText('Topiknya belum ketemu.')).toBeVisible();
  await page.getByRole('button', { name: 'Tampilkan semua topik' }).click();
  await page.getByRole('button', { name: /Join:/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coba ruang debat' })).toBeDisabled();
  await page.getByRole('button', { name: /Pro Saya mendukung/ }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Coba ruang debat' }).click();
  await expect(page).toHaveURL(/\/call\/.*side=pro/);
  await expect(page.getByText('Ruang pratinjau', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Pesan teks' })).toBeDisabled();
  await page.getByRole('button', { name: 'Coba mikrofon', exact: true }).click();
  await expect(page.getByText('Mic aktif', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rendah', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Pitch suara' })).toHaveValue('-4');
  await page.getByRole('button', { name: 'Dengar suaramu' }).click();
  await expect(page.getByRole('button', { name: 'Hentikan tes' })).toBeVisible();
  await page.getByRole('button', { name: 'Hentikan tes' }).click();
  await page.getByRole('button', { name: 'Nyalakan kamera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Matikan kamera', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'Matikan mikrofon', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Nyalakan mikrofon', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Stop / Exit' }).click();
  await expect(page).toHaveURL('/');
  expect(errors).toEqual([]);
});

test('admin preview supports complete persisted topic CRUD', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Buka pratinjau dashboard' }).click();
  await page.getByRole('button', { name: 'Tambah topik', exact: true }).click();
  await page.getByLabel('Judul / mosi diskusi').fill('Transportasi publik sebaiknya gratis?');
  await page
    .getByLabel('Deskripsi', { exact: false })
    .fill('Menimbang akses masyarakat dan pembiayaan transportasi kota.');
  await page.getByRole('button', { name: 'Buat topik' }).click();
  await expect(page.getByRole('status')).toContainText('Topik baru berhasil');
  await page.getByRole('button', { name: 'Edit Transportasi publik sebaiknya gratis?' }).click();
  await page.getByLabel('Judul / mosi diskusi').fill('Transportasi publik gratis di semua kota?');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Transportasi publik gratis di semua kota?' });
  await row.getByRole('button', { name: 'Aktif', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Nonaktif', exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Nonaktif', exact: true }).click();
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Transportasi publik gratis di semua kota?' })
  ).toBeVisible();
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Buka pratinjau dashboard' }).click();
  await page
    .getByRole('button', { name: 'Hapus Transportasi publik gratis di semua kota?' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus topik', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit Transportasi publik gratis di semua kota?' })
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Buka pratinjau dashboard' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('mobile layout fits screen and guideline and error pages work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.topic-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.goto('/call/a0000000-0000-4000-8000-000000000001?side=kontra');
  await expect(page.getByText('Ruang pratinjau', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/call-mobile.png', fullPage: true });
  await page.goto('/panduan');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ruang debat');
  await page.goto('/halaman-tidak-ada');
  await expect(page.getByRole('heading', { name: 'Ruang ini belum ada.' })).toBeVisible();
});
