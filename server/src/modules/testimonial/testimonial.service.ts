import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { parseDateOfBirth, type TestimonialData } from '@school/shared-schemas';
import { prisma } from '@/config/prisma.js';
import { resolveR2FileBuffer } from '@/config/r2.js';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { schoolWebsiteHost } from '@/utils/schoolPublicOrigin.util.js';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnNum = (v: string | number) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const BOARD_BN: Record<string, string> = {
  'Dhaka Education Board': 'ঢাকা শিক্ষা বোর্ড',
  'Rajshahi Education Board': 'রাজশাহী শিক্ষা বোর্ড',
  'Chattogram Education Board': 'চট্টগ্রাম শিক্ষা বোর্ড',
  'Cumilla Education Board': 'কুমিল্লা শিক্ষা বোর্ড',
  'Jashore Education Board': 'যশোর শিক্ষা বোর্ড',
  'Barishal Education Board': 'বরিশাল শিক্ষা বোর্ড',
  'Sylhet Education Board': 'সিলেট শিক্ষা বোর্ড',
  'Dinajpur Education Board': 'দিনাজপুর শিক্ষা বোর্ড',
  'Mymensingh Education Board': 'ময়মনসিংহ শিক্ষা বোর্ড',
  'Bangladesh Technical Education Board': 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড',
  'Bangladesh Madrasah Education Board': 'বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড',
};
const EXAM_BN: Record<string, string> = { SSC: 'এসএসসি', JSC: 'জেএসসি' };
const CLASS_BN: Record<string, string> = { '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম' };
const CLASS_EN: Record<string, string> = { '6': 'Six', '7': 'Seven', '8': 'Eight' };

const fontBase64 = (file: string) => {
  const p = path.join('public', 'fonts', file);
  return fs.existsSync(p) ? fs.readFileSync(p).toString('base64') : '';
};

async function loadSchool() {
  const schoolId = requireSchoolId();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      nameBn: true,
      eiin: true,
      schoolCode: true,
      upazila: true,
      district: true,
      customDomain: true,
      ownership: true,
      logo: true,
      board: true,
      gender: true,
    },
  });
  if (!school) throw new ApiError(404, 'School not found');

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
      console.warn('Failed to load school logo for testimonial PDF:', err);
    }
  }
  const host = schoolWebsiteHost(school.customDomain);
  return {
    ...school,
    web: host ? `https://${host}` : '',
    place: [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', '),
    logo,
    isGov: school.ownership === 'Government',
  };
}

type School = Awaited<ReturnType<typeof loadSchool>>;

function buildHtml(d: TestimonialData, s: School) {
  const male = s.gender === 'Boys' || (s.gender !== 'Girls' && d.gender === 'Male');
  const he = male ? 'he' : 'she';
  const his = male ? 'his' : 'her';
  const dob = ddmmyyyy(parseDateOfBirth(d.dob)!);
  const isBoard = d.kind === 'board';
  const year = d.passing_year;
  const gpa = isBoard ? Number(d.gpa).toFixed(2) : '';
  const codes = [s.eiin && `EIIN: ${s.eiin}`, s.schoolCode && `School Code: ${s.schoolCode}`]
    .filter(Boolean)
    .join(', ');
  const b = (v: unknown) => `<b>${esc(v)}</b>`;
  const bBn = (v: string) => `<b>${v}</b>`;

  // Same structure as the admin-panel certificate: centred header, double rule,
  // memo/date row, title, justified body with bold values,
  // dashed cut line, then the office-copy receipt.
  const section = (bn: boolean) => {
    const schoolName = esc(bn ? s.nameBn || s.name : s.name);
    const examBn = EXAM_BN[d.exam];
    const bodyBn = isBoard
      ? `প্রত্যয়ন করা যাচ্ছে যে, ${bBn(esc(d.student_name_bn))}, পিতা: ${bBn(esc(d.father_name_bn))}, মাতা: ${bBn(esc(d.mother_name_bn))} এ বিদ্যালয় হতে ${bBn((BOARD_BN[s.board!] ?? esc(s.board)) + 'ের')} অধীনে ${bBn(bnNum(year))} সালে ${examBn} পরীক্ষায় অংশগ্রহণ করে জিপিএ ${bBn(bnNum(gpa))} প্রাপ্ত হয়ে উত্তীর্ণ হয়েছে। তার ${examBn} পরীক্ষার রোল নম্বর ${bBn(bnNum(d.roll!))} এবং রেজিস্ট্রেশন নম্বর ${bBn(bnNum(d.registration_no!))}। বিদ্যালয়ের তথ্য অনুযায়ী তার জন্ম তারিখ ${bBn(bnNum(dob))}।`
      : `প্রত্যয়ন করা যাচ্ছে যে, ${bBn(esc(d.student_name_bn))}, পিতা: ${bBn(esc(d.father_name_bn))}, মাতা: ${bBn(esc(d.mother_name_bn))} এ বিদ্যালয় হতে ${bBn(bnNum(year))} সালে বার্ষিক পরীক্ষায় অংশগ্রহণ করে ${bBn(CLASS_BN[d.exam] + ' শ্রেণিতে')} উত্তীর্ণ হয়েছে। বিদ্যালয়ের তথ্য অনুযায়ী তার জন্ম তারিখ ${bBn(bnNum(dob))}।`;
    const intro = `This is to certify that ${b(d.student_name_en)}, ${male ? 'son' : 'daughter'} of ${b(d.father_name_en)} and ${b(d.mother_name_en)}`;
    const bodyEn = isBoard
      ? `${intro}, bearing Roll Number ${b(d.roll)} and Registration Number ${b(d.registration_no)} from this school under ${b(s.board)}, duly passed the ${b(d.exam)} examination ${b(year)} securing GPA ${b(gpa)} in the scale of 5.00. According to the school information, ${his} date of birth is ${b(dob)}.`
      : `${intro}, a student of this school, has successfully passed Class ${b(CLASS_EN[d.exam])} in the annual examination of ${b(year)}. According to the school information, ${his} date of birth is ${b(dob)}.`;
    const tx = (en: string, bnText: string) => (bn ? bnText : en);
    const rows = bn
      ? [
          ['নাম', esc(d.student_name_bn)],
          ['পিতার নাম', esc(d.father_name_bn)],
          ['মাতার নাম', esc(d.mother_name_bn)],
          [
            isBoard ? `${examBn} পরীক্ষা` : 'শ্রেণি',
            isBoard
              ? `${bnNum(year)} | রোল নং: ${bnNum(d.roll!)} | রেজি. নং: ${bnNum(d.registration_no!)} | জিপিএ: ${bnNum(gpa)}`
              : `${CLASS_BN[d.exam]} | বার্ষিক পরীক্ষা ${bnNum(year)}`,
          ],
          ['জন্ম তারিখ', bnNum(dob)],
        ]
      : [
          ['Name', esc(d.student_name_en)],
          ["Father's Name", esc(d.father_name_en)],
          ["Mother's Name", esc(d.mother_name_en)],
          [
            isBoard ? `${d.exam} Exam` : 'Class',
            isBoard
              ? `${year} | Roll No.: ${esc(d.roll)} | Regi. No.: ${esc(d.registration_no)} | GPA: ${gpa}`
              : `${CLASS_EN[d.exam]} | Annual Exam ${year}`,
          ],
          ['Date of Birth', dob],
        ];
    return `
    <div class="page ${bn ? 'bn' : 'en'}">
      <div class="cert">
        <div class="hd">
          ${s.logo ? `<img class="logo" src="${s.logo}" alt="" />` : ''}
          ${
            '' /* Slogan box disabled — re-enable: <div class="slogan">“জুলাই চেতনায় গড়বো দেশ,<br />সবার আগে বাংলাদেশ”</div> */
          }
          ${s.isGov ? `<div class="l1">${tx("Government of the People's Republic of Bangladesh", 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার')}</div>` : '<div class="l1" style="visibility: hidden">&nbsp;</div>'}
          <div class="l2">${tx('The office of the Headmaster', 'প্রধান শিক্ষকের কার্যালয়')}</div>
          <div class="school">${schoolName}</div>
          ${s.place ? `<div class="l3">${esc(s.place)}</div>` : ''}
          ${s.web ? `<div class="l4 en">${esc(s.web)}</div>` : ''}
          ${codes ? `<div class="l4 en">${esc(codes)}</div>` : ''}
        </div>
        <div class="rule"></div>
        <div class="memo"><b>${tx('Memo No:', 'স্মারক নম্বর:')}</b><b class="dt">${tx('Date:', 'তারিখ:')}</b></div>
        <h1>${tx('Certificate', 'প্রত্যয়নপত্র')}</h1>
        <p>${bn ? bodyBn : bodyEn}</p>
        <p>${tx(
          `To the best of my knowledge, ${his} behavior is satisfactory. I do not know that ${he} is involved in any kind of activities against the discipline of this school or the state.`,
          'তার আচরণ সন্তোষজনক। সে এ বিদ্যালয়ের বা রাষ্ট্রের শৃঙ্খলা পরিপন্থী কোনো প্রকার কাজে জড়িত ছিল বলে আমার জানা নেই।',
        )}</p>
        <p class="nj">${tx(`I wish ${his} all success in life.`, 'আমি তার সর্বাঙ্গীণ কল্যাণ কামনা করি।')}</p>
      </div>
      <div class="rc">
        <div class="rs">${schoolName}</div>
        ${s.place ? `<div class="rl">${esc(s.place)}</div>` : ''}
        <div class="rt">${tx('Office Copy (Receipt / Acknowledgement)', 'অফিস কপি (প্রাপ্তি স্বীকার)')}</div>
        <div class="rm rmrow"><span>${tx('Memo No:', 'স্মারক নং:')}</span><span class="dt">${tx('Date:', 'তারিখ:')}</span></div>
        ${rows.map(([k, v]) => `<div class="rr">${k}: <b>${v}</b></div>`).join('')}
        <div class="rg">${tx('Received by: ...........................................', 'গ্রহীতার স্বাক্ষর: ...........................................')}</div>
        <div class="rg">${tx('Mobile: ...........................................', 'মোবাইল নং: ...........................................')}</div>
      </div>
    </div>`;
  };

  const bnFont = fontBase64('SolaimanLipi.woff2');
  const enFont = fontBase64('times.ttf');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><style>
    ${bnFont ? `@font-face { font-family: 'SolaimanLipi'; src: url(data:font/woff2;base64,${bnFont}) format('woff2'); }` : ''}
    ${enFont ? `@font-face { font-family: 'TNR'; src: url(data:font/truetype;base64,${enFont}) format('truetype'); }` : ''}
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { color: #000; background: #fff; }
    b { font-weight: bold; }
    .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .en, .bn .en { font-family: 'TNR', 'Times New Roman', serif; }
    .bn { font-family: 'SolaimanLipi', 'Noto Sans Bengali', sans-serif; }
    .cert { position: relative; height: 575pt; border-bottom: 1px dashed #666; margin: 0 15pt; padding: 35pt 55pt 0; }
    .slogan { position: absolute; right: 22pt; top: 2pt; border: 1px solid #000; padding: 1pt 6pt; font-family: 'SolaimanLipi', 'Noto Sans Bengali', sans-serif; font-size: 11.5pt; line-height: 1.25; white-space: nowrap; }
    .logo { position: absolute; left: 75pt; top: 0; width: 50pt; height: 50pt; object-fit: contain; }
    .hd { position: relative; text-align: center; margin: 0 -55pt; line-height: 1.25; }
    .l1 { font-size: 12pt; margin-bottom: 4pt; }
    .l2 { font-size: 14pt; margin-bottom: 4pt; }
    .school { font-size: 24pt; font-weight: bold; margin-bottom: 4pt; white-space: nowrap; }
    .l3 { font-size: 14pt; margin-bottom: 3pt; }
    .l4 { font-size: 13pt; margin-bottom: 3pt; }
    .rule { margin: 9pt -70pt 0; height: 5pt; border-top: 2px solid #000; border-bottom: 1px solid #000; }
    .dt { display: inline-block; min-width: 110pt; }
    .memo, .rmrow { display: grid; grid-template-columns: 72% 1fr; }
    .memo { margin-top: 9pt; font-size: 10pt; }
    h1 { text-align: center; font-size: 22pt; margin: 14pt 0 12pt; }
    .cert p { font-size: 12pt; line-height: 1.6; text-align: justify; margin-bottom: 6pt; }
    .bn .cert p { font-size: 14pt; line-height: 1.45; margin-bottom: 4pt; }
    .bn .l1 { font-size: 14pt; } .bn .l2 { font-size: 16pt; } .bn .school { font-size: 30pt; }
    .bn .l3 { font-size: 16pt; } .bn .memo { font-size: 12pt; } .bn h1 { font-size: 24pt; margin: 10pt 0 8pt; }
    .bn .rs { font-size: 17pt; } .bn .rl { font-size: 13pt; }
    .bn .rt { font-size: 14pt; } .bn .rm { font-size: 11pt; } .bn .rr, .bn .rg { font-size: 12pt; }
    .cert p.nj { text-align: left; }
    .rc { padding: 14pt 70pt 0; }
    .rs { text-align: center; font-size: 14pt; font-weight: bold; }
    .rl { text-align: center; font-size: 11pt; margin-top: 3pt; }
    .rt { text-align: center; font-size: 12pt; font-weight: bold; margin: 8pt 0 6pt; }
    .rm { font-size: 9pt; font-weight: bold; margin-bottom: 4pt; }
    .rr { font-size: 10pt; margin-bottom: 4pt; }
    .rg { font-size: 10pt; text-align: right; margin-bottom: 4pt; }
  </style></head><body>${section(true)}${section(false)}</body></html>`;
}

export async function generateTestimonialPdf(data: TestimonialData) {
  const school = await loadSchool();
  if (data.kind === 'board' && !school.board) {
    throw new ApiError(400, 'School education board is not configured. Please contact the school.');
  }
  if (school.gender !== 'Boys' && school.gender !== 'Girls' && !data.gender) {
    throw new ApiError(400, 'Gender is required');
  }
  const html = buildHtml(data, school);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--lang=bn-BD',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html.normalize('NFC'), { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready').catch(() => undefined);
    return await page.pdf({ format: 'a4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
