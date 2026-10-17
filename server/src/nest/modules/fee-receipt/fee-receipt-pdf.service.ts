import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import {
  PDF_BASE_CSS,
  ddmmyyyy,
  esc,
  htmlToPdf,
  loadSchoolHeader,
  money,
  schoolHeaderHtml,
} from '../../common/school-pdf.js';
import { PRISMA } from '../../common/prisma.module.js';
import { amountInWords } from './fee-calc.js';
import { FeeReceiptService, type ReceiptView } from './fee-receipt.service.js';

const MONTHS = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const copy = (header: string, r: ReceiptView, label: string) => `
  <section class="copy">
    ${header}
    <div class="title">MONEY RECEIPT <span class="label">${label}</span></div>
    <table class="meta"><tr>
      <td><b>Receipt No:</b> ${r.receipt_no}</td>
      <td class="r"><b>Date:</b> ${ddmmyyyy(r.date)}</td>
    </tr><tr>
      <td><b>Student:</b> ${esc(r.student.name)} (ID ${r.student.login_id})</td>
      <td class="r"><b>Class:</b> ${r.class} &nbsp; <b>Section:</b> ${esc(r.section)} &nbsp; <b>Roll:</b> ${r.roll}</td>
    </tr></table>
    <table>
      <thead><tr><th>Fee</th><th class="r">Charge</th><th class="r">Waiver</th><th class="r">Paid</th></tr></thead>
      <tbody>
        ${r.items
          .map(
            (i) => `<tr>
              <td>${esc(i.fee_head)}${i.month ? ` (${MONTHS[i.month]} ${r.year})` : ` (${r.year})`}</td>
              <td class="r">${money(i.charge)}</td>
              <td class="r">${money(i.waiver)}</td>
              <td class="r">${money(i.amount)}</td>
            </tr>`,
          )
          .join('')}
        <tr class="tot"><td colspan="3" class="r"><b>Total</b></td><td class="r"><b>${money(r.total)}</b></td></tr>
      </tbody>
    </table>
    <p class="words"><b>In words:</b> ${amountInWords(r.total)}</p>
    ${r.note ? `<p class="words"><b>Remarks:</b> ${esc(r.note)}</p>` : ''}
    <p class="words"><b>Received in:</b> ${r.accounts
      .map((a) => (r.accounts.length > 1 ? `${esc(a.name)} (${money(a.amount)})` : esc(a.name)))
      .join(', ')}</p>
    <div class="sign">Accountant Signature</div>
  </section>`;

@Injectable()
export class FeeReceiptPdfService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly receipts: FeeReceiptService,
  ) {}

  async generate(schoolId: number, id: number) {
    const [receipt, school] = await Promise.all([
      this.receipts.findOne(schoolId, id),
      loadSchoolHeader(this.prisma, schoolId),
    ]);
    const header = schoolHeaderHtml(school);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      ${PDF_BASE_CSS}
      .copy { height: 128mm; padding: 4mm 2mm; }
      .copy + .copy { border-top: 1px dashed #666; }
      .title { margin: 6pt 0; text-align: center; font-size: 12pt; font-weight: 700; }
      .label { font-size: 8pt; font-weight: 400; border: 1px solid #444; padding: 1pt 4pt; margin-left: 6pt; }
      .meta td { border: 0; padding: 1pt 0; }
      .tot td { background: #f5f5f5; }
      .words { margin: 5pt 0 0; }
      .sign { margin-top: 26pt; width: 45%; border-top: 1px solid #444; padding-top: 2pt; font-size: 9pt; }
    </style></head><body>
      ${copy(header, receipt, 'Institute Copy')}${copy(header, receipt, 'Student Copy')}
    </body></html>`;
    return { buffer: await htmlToPdf(html), name: `Receipt_${receipt.receipt_no}` };
  }
}
