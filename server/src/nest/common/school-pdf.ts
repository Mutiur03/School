import path from 'path';
import puppeteer from 'puppeteer';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { resolveR2FileBuffer } from '@/config/r2.js';
import { NotFoundException } from '@nestjs/common';

export const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ddmmyyyy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** School name block for PDF headers: never the full address (upazila + district only). */
export async function loadSchoolHeader(prisma: PrismaClient, schoolId: number) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, upazila: true, district: true, ownership: true, logo: true, eiin: true },
  });
  if (!school) throw new NotFoundException('School not found');

  let logo = '';
  if (school.logo) {
    try {
      const buf = await resolveR2FileBuffer(school.logo, schoolId);
      if (buf?.length) {
        const ext = path.extname(school.logo).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        logo = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch (err) {
      console.warn('Failed to load school logo for PDF:', err);
    }
  }
  return {
    name: school.name,
    eiin: school.eiin,
    logo,
    place: [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', '),
    isGov: school.ownership === 'Government',
  };
}
export type SchoolHeader = Awaited<ReturnType<typeof loadSchoolHeader>>;

export const schoolHeaderHtml = (h: SchoolHeader) => `
  <div class="hd">
    ${h.logo ? `<img class="logo" src="${h.logo}" />` : ''}
    <div class="hd-text">
      ${h.isGov ? '<div class="gov">Government of the People\'s Republic of Bangladesh</div>' : ''}
      <div class="sch">${esc(h.name)}</div>
      ${h.place ? `<div class="place">${esc(h.place)}</div>` : ''}
    </div>
  </div>`;

export const PDF_BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
  .hd { display: flex; align-items: center; justify-content: center; gap: 10pt; text-align: center; }
  .logo { height: 44pt; width: 44pt; object-fit: contain; }
  .gov { font-size: 8pt; }
  .sch { font-size: 14pt; font-weight: 700; }
  .place { font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 3pt 5pt; }
  th { background: #eee; text-align: left; }
  .r { text-align: right; }
  .c { text-align: center; }
`;

export async function htmlToPdf(html: string, opts: { landscape?: boolean } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html.normalize('NFC'), { waitUntil: 'load' });
    return Buffer.from(
      await page.pdf({
        format: 'a4',
        landscape: opts.landscape,
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
      }),
    );
  } finally {
    await browser.close();
  }
}
