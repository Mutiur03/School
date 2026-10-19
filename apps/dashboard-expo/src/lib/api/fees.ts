/**
 * Fee endpoints (Nest, `Auth('admin')`, the school always from the token via `@SchoolId()`),
 * verified against server/src/nest/modules/fees/*:
 *
 *   GET/POST /api/fee-heads, PATCH/DELETE /api/fee-heads/:id
 *   GET  /api/fee-structures?year&class
 *   PUT  /api/fee-structures { year, class, items: [{ fee_head_id, amount }] }  replaces the class
 *   POST /api/fee-structures { from_year, to_year } → { copied }        copies missing classes
 *   GET  /api/fee-waivers?year&student_id, POST, PATCH/DELETE /:id
 *   GET  /api/fee-receipts?from&to&class&section&student_id&receipt_no   (latest 500)
 *   GET  /api/fee-receipts/statement?student_id&year
 *   POST /api/fee-receipts { student_id, year, date, pay_head_id?, note?, items }
 *        amounts are NOT sent: the server recomputes every item from the structure and waivers;
 *        a paid/waived item, a duplicate item or a closed year is rejected, and a unique index on
 *        (school, student, year, head, month) stops the same installment being collected twice.
 *   GET  /api/fee-receipts/:id/pdf, DELETE /api/fee-receipts/:id   (also deletes its voucher)
 *   GET  /api/fee-reports/summary?date, collection?from&to (+ /pdf), dues?year&class&section&upto_month (+ /pdf)
 *
 * Money: the server stores Decimal(12, 2) taka and does its math in integer paisa; every amount
 * here is parsed straight into paisa (`toPaisa`) and request amounts are sent with `toTaka`.
 * school_id is never sent.
 */
import { toPaisa, toTaka, type Paisa } from '../money/money';
import type { ApiClient } from './client';
import {
  parseError,
  bool,
  isObj,
  num,
  numOrNull,
  objArray,
  str,
  strOrNull,
  ymd,
  type Json,
} from './parse';

export type FeeFrequency = 'monthly' | 'once';

export const FEE_PATHS = {
  heads: '/api/fee-heads',
  head: (id: number) => `/api/fee-heads/${id}`,
  structures: '/api/fee-structures',
  waivers: '/api/fee-waivers',
  waiver: (id: number) => `/api/fee-waivers/${id}`,
  receipts: '/api/fee-receipts',
  receipt: (id: number) => `/api/fee-receipts/${id}`,
  receiptPdf: (id: number) => `/api/fee-receipts/${id}/pdf`,
  statement: '/api/fee-receipts/statement',
  summary: '/api/fee-reports/summary',
  collection: '/api/fee-reports/collection',
  collectionPdf: '/api/fee-reports/collection/pdf',
  dues: '/api/fee-reports/dues',
  duesPdf: '/api/fee-reports/dues/pdf',
} as const;

export interface NamedRef {
  id: number;
  name: string;
}

export interface FeeHead {
  id: number;
  name: string;
  frequency: FeeFrequency;
  income_head_id: number;
  income_head: NamedRef | null;
  /** Fixed cash/bank account; null = the cashier picks one at collection. */
  deposit_head_id: number | null;
  deposit_head: NamedRef | null;
  is_waivable: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FeeHeadInput {
  name: string;
  frequency: FeeFrequency;
  /** Omitted → the server creates "<name> Fees". */
  income_head_id?: number;
  deposit_head_id: number | null;
  is_waivable: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FeeStructureRow {
  id: number;
  year: number;
  class: number;
  fee_head_id: number;
  amount: Paisa;
  fee_head: { id: number; name: string; frequency: FeeFrequency } | null;
}

export interface FeeWaiver {
  id: number;
  student_id: number;
  year: number;
  fee_head_id: number | null;
  percent: boolean;
  /** Percent waivers: hundredths of a percent (12.5% = 1250). Flat waivers: paisa. */
  value: Paisa;
  note: string | null;
  student: { id: number; name: string; login_id: string } | null;
  fee_head: NamedRef | null;
}

export interface FeeWaiverInput {
  student_id: number;
  year: number;
  /** Omitted = every waivable head. */
  fee_head_id?: number;
  percent: boolean;
  /** Paisa, or hundredths of a percent. */
  value: Paisa;
  note?: string;
}

export type DueStatus = 'paid' | 'due' | 'waived';

export interface DueRow {
  fee_head_id: number;
  fee_head: string;
  /** 1-12, or 0 for a one-off fee. */
  month: number;
  charge: Paisa;
  waiver: Paisa;
  payable: Paisa;
  status: DueStatus;
  receipt_no: number | null;
  paid_amount: Paisa;
  deposit: NamedRef | null;
}

export interface FeeStatement {
  student: { id: number; name: string; login_id: string; father_name: string | null };
  enrollment: { year: number; class: number; section: string; roll: number };
  rows: DueRow[];
  totals: { waiver: Paisa; paid: Paisa; due: Paisa };
}

export interface FeeReceiptInput {
  student_id: number;
  year: number;
  /** YYYY-MM-DD */
  date: string;
  /** Only when a picked fee has no fixed deposit account. */
  pay_head_id?: number;
  note?: string;
  items: { fee_head_id: number; month: number }[];
}

export interface FeeReceiptListItem {
  id: number;
  receipt_no: number;
  date: string;
  year: number;
  class: number;
  section: string;
  roll: number;
  total: Paisa;
  student: { id: number; name: string; login_id: string } | null;
  accounts: { id: number; name: string; amount: Paisa }[];
  voucher_no: string;
}

export interface FeeReceiptFilters {
  from?: string;
  to?: string;
  class?: number;
  section?: string;
  student_id?: number;
  receipt_no?: number;
}

export interface FeeSummary {
  today: Paisa;
  month: Paisa;
  year: Paisa;
  last_7_days: { date: string; total: Paisa }[];
  latest: {
    id: number;
    receipt_no: number;
    date: string;
    total: Paisa;
    student_name: string;
    login_id: string;
    class: number;
    section: string;
    roll: number;
  }[];
}

export interface FeeCollectionReport {
  from: string;
  to: string;
  total: Paisa;
  count: number;
  by_day: { date: string; count: number; total: Paisa }[];
  by_class: { class: number; count: number; total: Paisa }[];
  by_account: { deposit_head_id: number; name: string; total: Paisa }[];
  by_head: { fee_head_id: number; name: string; count: number; waiver: Paisa; total: Paisa }[];
}

export interface FeeDuesRow {
  student_id: number;
  name: string;
  login_id: string;
  section: string;
  roll: number;
  charge: Paisa;
  waiver: Paisa;
  paid: Paisa;
  due: Paisa;
}

export interface FeeDuesReport {
  rows: FeeDuesRow[];
  total_due: Paisa;
}

export interface FeeDuesQuery {
  year: number;
  class: number;
  section?: string;
  upto_month?: number;
}

const ref = (v: unknown): NamedRef | null =>
  isObj(v) && num(v.id, 0) > 0 ? { id: num(v.id), name: str(v.name) } : null;

const frequency = (v: unknown): FeeFrequency => (v === 'once' ? 'once' : 'monthly');

export function parseFeeHead(r: Json): FeeHead {
  return {
    id: num(r.id),
    name: str(r.name),
    frequency: frequency(r.frequency),
    income_head_id: num(r.income_head_id),
    income_head: ref(r.income_head),
    deposit_head_id: numOrNull(r.deposit_head_id),
    deposit_head: ref(r.deposit_head),
    is_waivable: bool(r.is_waivable, true),
    sort_order: num(r.sort_order),
    is_active: bool(r.is_active, true),
  };
}

export function parseStructureRow(r: Json): FeeStructureRow {
  const h = isObj(r.fee_head) ? r.fee_head : null;
  return {
    id: num(r.id),
    year: num(r.year),
    class: num(r.class),
    fee_head_id: num(r.fee_head_id),
    amount: toPaisa(r.amount),
    fee_head: h ? { id: num(h.id), name: str(h.name), frequency: frequency(h.frequency) } : null,
  };
}

const studentRef = (v: unknown) =>
  isObj(v) ? { id: num(v.id), name: str(v.name), login_id: str(v.login_id) } : null;

export function parseWaiver(r: Json): FeeWaiver {
  return {
    id: num(r.id),
    student_id: num(r.student_id),
    year: num(r.year),
    fee_head_id: numOrNull(r.fee_head_id),
    percent: bool(r.percent),
    // both kinds have two decimals on the server (Decimal(12,2)), so ×100 is exact either way
    value: toPaisa(r.value),
    note: strOrNull(r.note),
    student: studentRef(r.student),
    fee_head: ref(r.fee_head),
  };
}

const STATUSES: readonly DueStatus[] = ['paid', 'due', 'waived'];

export function parseDueRow(r: Json): DueRow {
  return {
    fee_head_id: num(r.fee_head_id),
    fee_head: str(r.fee_head),
    month: num(r.month),
    charge: toPaisa(r.charge),
    waiver: toPaisa(r.waiver),
    payable: toPaisa(r.payable),
    status: STATUSES.includes(r.status as DueStatus) ? (r.status as DueStatus) : 'due',
    receipt_no: numOrNull(r.receipt_no),
    paid_amount: toPaisa(r.paid_amount),
    deposit: ref(r.deposit),
  };
}

export function parseStatement(data: unknown): FeeStatement {
  if (!isObj(data) || !isObj(data.student) || !isObj(data.enrollment))
    throw parseError(FEE_PATHS.statement);
  const s = data.student;
  const e = data.enrollment;
  const t = isObj(data.totals) ? data.totals : {};
  return {
    student: {
      id: num(s.id),
      name: str(s.name),
      login_id: str(s.login_id),
      father_name: strOrNull(s.father_name),
    },
    enrollment: {
      year: num(e.year),
      class: num(e.class),
      section: str(e.section),
      roll: num(e.roll),
    },
    rows: objArray(data.rows, FEE_PATHS.statement).map(parseDueRow),
    totals: { waiver: toPaisa(t.waiver), paid: toPaisa(t.paid), due: toPaisa(t.due) },
  };
}

export function parseReceiptListItem(r: Json): FeeReceiptListItem {
  return {
    id: num(r.id),
    receipt_no: num(r.receipt_no),
    date: ymd(r.date),
    year: num(r.year),
    class: num(r.class),
    section: str(r.section),
    roll: num(r.roll),
    total: toPaisa(r.total),
    student: studentRef(r.student),
    accounts: (Array.isArray(r.accounts) ? r.accounts.filter(isObj) : []).map((a) => ({
      id: num(a.id),
      name: str(a.name),
      amount: toPaisa(a.amount),
    })),
    voucher_no: str(r.voucher_no),
  };
}

export function parseSummary(data: unknown): FeeSummary {
  if (!isObj(data)) throw parseError(FEE_PATHS.summary);
  return {
    today: toPaisa(data.today),
    month: toPaisa(data.month),
    year: toPaisa(data.year),
    last_7_days: (Array.isArray(data.last_7_days) ? data.last_7_days.filter(isObj) : []).map(
      (d) => ({ date: ymd(d.date), total: toPaisa(d.total) }),
    ),
    latest: (Array.isArray(data.latest) ? data.latest.filter(isObj) : []).map((r) => {
      const st = isObj(r.student) ? r.student : {};
      return {
        id: num(r.id),
        receipt_no: num(r.receipt_no),
        date: ymd(r.date),
        total: toPaisa(r.total),
        student_name: str(st.name),
        login_id: str(st.login_id),
        class: num(r.class),
        section: str(r.section),
        roll: num(r.roll),
      };
    }),
  };
}

const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : []);

export function parseCollection(data: unknown): FeeCollectionReport {
  if (!isObj(data)) throw parseError(FEE_PATHS.collection);
  return {
    from: ymd(data.from),
    to: ymd(data.to),
    total: toPaisa(data.total),
    count: num(data.count),
    by_day: list(data.by_day).map((d) => ({
      date: ymd(d.date),
      count: num(d.count),
      total: toPaisa(d.total),
    })),
    by_class: list(data.by_class).map((d) => ({
      class: num(d.class),
      count: num(d.count),
      total: toPaisa(d.total),
    })),
    by_account: list(data.by_account).map((d) => ({
      deposit_head_id: num(d.deposit_head_id),
      name: str(d.name),
      total: toPaisa(d.total),
    })),
    by_head: list(data.by_head).map((d) => ({
      fee_head_id: num(d.fee_head_id),
      name: str(d.name),
      count: num(d.count),
      waiver: toPaisa(d.waiver),
      total: toPaisa(d.total),
    })),
  };
}

export function parseDues(data: unknown): FeeDuesReport {
  if (!isObj(data)) throw parseError(FEE_PATHS.dues);
  return {
    rows: objArray(data.rows, FEE_PATHS.dues).map((r) => ({
      student_id: num(r.student_id),
      name: str(r.name),
      login_id: str(r.login_id),
      section: str(r.section),
      roll: num(r.roll),
      charge: toPaisa(r.charge),
      waiver: toPaisa(r.waiver),
      paid: toPaisa(r.paid),
      due: toPaisa(r.due),
    })),
    total_due: toPaisa(data.total_due),
  };
}

/** Body of POST/PATCH /api/fee-heads. `income_head_id` only when chosen. */
export function feeHeadBody(input: FeeHeadInput): Json {
  return {
    name: input.name.trim(),
    frequency: input.frequency,
    ...(input.income_head_id ? { income_head_id: input.income_head_id } : {}),
    deposit_head_id: input.deposit_head_id,
    is_waivable: input.is_waivable,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };
}

export function structureBody(p: {
  year: number;
  cls: number;
  items: readonly { fee_head_id: number; amount: Paisa }[];
}): Json {
  return {
    year: p.year,
    class: p.cls,
    items: p.items.map((i) => ({ fee_head_id: i.fee_head_id, amount: toTaka(i.amount) })),
  };
}

export function waiverBody(input: FeeWaiverInput): Json {
  return {
    student_id: input.student_id,
    year: input.year,
    ...(input.fee_head_id ? { fee_head_id: input.fee_head_id } : {}),
    percent: input.percent,
    value: toTaka(input.value),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

/**
 * PATCH body: no student_id (UpdateFeeWaiverDto omits it and the pipe rejects unknown keys);
 * fee_head_id and note are always sent, null meaning "all fees" / "no note", so both can be
 * cleared.
 */
export function waiverPatchBody(input: FeeWaiverInput): Json {
  const { student_id: _omit, ...rest } = waiverBody(input);
  return { ...rest, fee_head_id: input.fee_head_id ?? null, note: input.note?.trim() || null };
}

export function receiptBody(input: FeeReceiptInput): Json {
  return {
    student_id: input.student_id,
    year: input.year,
    date: input.date,
    ...(input.pay_head_id ? { pay_head_id: input.pay_head_id } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    items: input.items.map((i) => ({ fee_head_id: i.fee_head_id, month: i.month })),
  };
}

const defined = (q: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Record<
    string,
    string | number
  >;

export function receiptQuery(f: FeeReceiptFilters) {
  return defined({
    from: f.from,
    to: f.to,
    class: f.class,
    section: f.section,
    student_id: f.student_id,
    receipt_no: f.receipt_no,
  });
}

export const duesQuery = (q: FeeDuesQuery) =>
  defined({ year: q.year, class: q.class, section: q.section, upto_month: q.upto_month });

const pdf = { responseType: 'arrayBuffer' as const, timeoutMs: 130_000 };

export function createFeesApi(client: ApiClient) {
  return {
    async heads(): Promise<FeeHead[]> {
      return objArray(await client.get(FEE_PATHS.heads), FEE_PATHS.heads).map(parseFeeHead);
    },
    async createHead(input: FeeHeadInput) {
      await client.post(FEE_PATHS.heads, feeHeadBody(input));
    },
    async updateHead(id: number, input: FeeHeadInput) {
      await client.patch(FEE_PATHS.head(id), feeHeadBody(input));
    },
    async deleteHead(id: number) {
      await client.delete(FEE_PATHS.head(id));
    },

    async structures(year: number, cls?: number): Promise<FeeStructureRow[]> {
      const data = await client.get(FEE_PATHS.structures, {
        query: defined({ year, class: cls }),
      });
      return objArray(data, FEE_PATHS.structures).map(parseStructureRow);
    },
    async saveStructure(p: {
      year: number;
      cls: number;
      items: readonly { fee_head_id: number; amount: Paisa }[];
    }) {
      await client.put(FEE_PATHS.structures, structureBody(p));
    },
    async copyStructure(fromYear: number, toYear: number): Promise<{ copied: number }> {
      const data = await client.post(FEE_PATHS.structures, {
        from_year: fromYear,
        to_year: toYear,
      });
      return { copied: isObj(data) ? num(data.copied) : 0 };
    },

    async waivers(q: { year: number; student_id?: number }): Promise<FeeWaiver[]> {
      const data = await client.get(FEE_PATHS.waivers, {
        query: defined({ year: q.year, student_id: q.student_id }),
      });
      return objArray(data, FEE_PATHS.waivers).map(parseWaiver);
    },
    async createWaiver(input: FeeWaiverInput) {
      await client.post(FEE_PATHS.waivers, waiverBody(input));
    },
    async updateWaiver(id: number, input: FeeWaiverInput) {
      await client.patch(FEE_PATHS.waiver(id), waiverPatchBody(input));
    },
    async deleteWaiver(id: number) {
      await client.delete(FEE_PATHS.waiver(id));
    },

    async statement(studentId: number, year: number): Promise<FeeStatement> {
      return parseStatement(
        await client.get(FEE_PATHS.statement, { query: { student_id: studentId, year } }),
      );
    },
    async receipts(f: FeeReceiptFilters): Promise<FeeReceiptListItem[]> {
      const data = await client.get(FEE_PATHS.receipts, { query: receiptQuery(f) });
      return objArray(data, FEE_PATHS.receipts).map(parseReceiptListItem);
    },
    /** Collects fees; returns the new receipt's id and number. */
    async collect(input: FeeReceiptInput): Promise<{ id: number; receipt_no: number | null }> {
      // Long timeout: a timed-out request may still have been saved, so the screen re-reads the
      // statement before letting anyone try again.
      const data = await client.post(FEE_PATHS.receipts, receiptBody(input), {
        timeoutMs: 60_000,
      });
      if (!isObj(data) || num(data.id, 0) <= 0) throw parseError(FEE_PATHS.receipts);
      return { id: num(data.id), receipt_no: numOrNull(data.receipt_no) };
    },
    async deleteReceipt(id: number) {
      await client.delete(FEE_PATHS.receipt(id));
    },
    receiptPdf(id: number) {
      return client.get<ArrayBuffer>(FEE_PATHS.receiptPdf(id), pdf);
    },

    async summary(date?: string): Promise<FeeSummary> {
      return parseSummary(await client.get(FEE_PATHS.summary, { query: defined({ date }) }));
    },
    async collection(from: string, to: string): Promise<FeeCollectionReport> {
      return parseCollection(await client.get(FEE_PATHS.collection, { query: { from, to } }));
    },
    collectionPdf(from: string, to: string) {
      return client.get<ArrayBuffer>(FEE_PATHS.collectionPdf, { ...pdf, query: { from, to } });
    },
    async dues(q: FeeDuesQuery): Promise<FeeDuesReport> {
      return parseDues(await client.get(FEE_PATHS.dues, { query: duesQuery(q) }));
    },
    duesPdf(q: FeeDuesQuery) {
      return client.get<ArrayBuffer>(FEE_PATHS.duesPdf, { ...pdf, query: duesQuery(q) });
    },
  };
}

export type FeesApi = ReturnType<typeof createFeesApi>;
