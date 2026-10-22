/**
 * Pure logic for batch 4 pages: head message paragraphs, SMS templates and estimates (with the
 * shared calculateSMSCount / PHONE_NUMBER), alumni filters, billing view (shared status fields),
 * row selection, QR matrix, holiday calendar helpers and the staff form.
 * `@school/shared-schemas` is ESM-only, so runtime use goes through a dynamic import.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AlumnusRow, Holiday, SmsLog, SmsSettings, StaffRow, Subscription } from '@/lib/api';
import { pageState, retainIds, sameIds, toggleId, togglePage } from '@/features/admin/selection';
import { alumniAddress, alumniFacets, alumniSummary, filterAlumni } from '@/features/alumni/model';
import { billingView, formatBillingDate } from '@/features/billing/model';
import {
  messageCounter,
  sameDraft,
  splitSentences,
  toParagraphs,
} from '@/features/head-message/model';
import { holidayDaysInMonth, holidaysOn } from '@/features/holidays/model';
import { qrMatrix, qrPath } from '@/features/school-codes/qr';
import {
  bulkCost,
  displayDate,
  estimateLine,
  fillSmsTemplate,
  initialRequired,
  retryableIds,
  settingsErrors,
  testSmsErrors,
  typeSummary,
  validateTemplate,
} from '@/features/sms/model';
import {
  filterStaff,
  issuesToErrors,
  staffDefaults,
  staffDesignations,
  staffStats,
  toStaffInput,
} from '@/features/staff/model';

const shared = () => import('@school/shared-schemas');

describe('head message', () => {
  it('splits sentences on Bangla and Latin punctuation without lookbehind', () => {
    assert.deepEqual(splitSentences('এক। দুই! Three? four.'), ['এক।', 'দুই!', 'Three?', 'four.']);
    assert.deepEqual(splitSentences('no end'), ['no end']);
  });
  it('blank lines win; otherwise two sentences per paragraph', () => {
    assert.deepEqual(toParagraphs('a\n\n b \n\n'), ['a', 'b']);
    assert.deepEqual(toParagraphs('এক। দুই। তিন।'), ['এক। দুই।', 'তিন।']);
    assert.deepEqual(toParagraphs('   '), []);
    assert.equal(messageCounter('এক। দুই। তিন।'), '13 chars · 3 words · 2 paragraphs');
  });
  it('sameDraft compares all three fields', () => {
    const a = { teacherId: 1, role: 'Headmaster', message: 'x' };
    assert.equal(sameDraft(a, { ...a }), true);
    assert.equal(sameDraft(a, { ...a, role: 'Headmaster (Incharge)' }), false);
  });
});

describe('sms templates', () => {
  const draft: SmsSettings = {
    present_template: '{student_name} present',
    absent_template: '{student_name} absent on {date}',
    run_awayed_template: '',
    send_to_present: true,
    send_to_absent: true,
    send_to_run_awayed: true,
    is_active: true,
  };
  it('requires {student_name} and the ticked electives, forbids unticked ones', () => {
    assert.equal(validateTemplate('{student_name} {date}', ['{date}']).isValid, true);
    assert.deepEqual(validateTemplate('hi {date}', []).missing, ['{student_name}']);
    assert.deepEqual(validateTemplate('{student_name} {date}', []).forbidden, ['{date}']);
  });
  it('errors only for enabled templates while the master switch is on', () => {
    const e = settingsErrors(draft, []);
    assert.equal(e.present_template, undefined);
    assert.equal(e.absent_template, 'To save: remove {date}.');
    assert.equal(e.run_awayed_template, 'Message is empty.');
    assert.deepEqual(settingsErrors({ ...draft, is_active: false }, []), {});
    assert.deepEqual(initialRequired(draft), ['{date}']);
  });
  it('fills tokens and estimates with the shared counter', async () => {
    const { calculateSMSCount } = await shared();
    assert.equal(fillSmsTemplate('{student_name}/{roll}', { student_name: 'A', roll: 3 }), 'A/3');
    assert.equal(estimateLine('', calculateSMSCount), '');
    assert.match(
      estimateLine('hello', calculateSMSCount, ' per student'),
      /^≈ 1 credit per student · 5 chars · GSM-7$/,
    );
    assert.match(estimateLine('হ্যালো', calculateSMSCount), /Unicode$/);
    const cost = bulkCost(10, 'hello', calculateSMSCount, 5);
    assert.deepEqual(cost, { per: 1, credits: 10, tooExpensive: true });
    assert.equal(bulkCost(10, 'hi', calculateSMSCount, null).tooExpensive, false);
  });
  it('test SMS validation uses the shared phone rule', async () => {
    const { PHONE_NUMBER } = await shared();
    assert.deepEqual(testSmsErrors('017 1111 1111', ' hi ', PHONE_NUMBER), {
      phone: '01711111111',
      message: 'hi',
      errors: {},
    });
    assert.equal(
      testSmsErrors('12345', '', PHONE_NUMBER).errors.phoneNumber,
      'Phone must be 11 digits and start with 01.',
    );
    assert.equal(testSmsErrors('', '', PHONE_NUMBER).errors.message, 'Message is required.');
  });
  it('retries only unsent selected rows; labels', () => {
    const log = (id: number, status: SmsLog['status']) => ({ id, status }) as SmsLog;
    const logs = [log(1, 'sent'), log(2, 'failed'), log(3, 'pending'), log(4, 'failed')];
    assert.deepEqual(retryableIds(logs, new Set([1, 2, 3])), [2, 3]);
    assert.equal(displayDate('2026-10-04'), '04/10/2026');
    assert.equal(typeSummary([]), 'All types');
    assert.equal(typeSummary(['bulk', 'test']), 'Bulk, Test');
  });
});

describe('alumni', () => {
  const a = (o: Partial<AlumnusRow>) =>
    ({
      id: 1,
      name: 'X',
      batch: '2020',
      district: null,
      father_phone: null,
      mother_phone: null,
      ...o,
    }) as AlumnusRow;
  const rows = [
    a({ id: 1, name: 'Zara', batch: '2019', district: 'Rangpur' }),
    a({ id: 2, name: 'Amin', batch: '2021', district: 'Dhaka', mother_phone: '01799999999' }),
    a({ id: 3, name: 'Bina', batch: '2021', district: 'Rangpur' }),
  ];
  it('facets, search by name or phone, filters and sorts', () => {
    assert.deepEqual(alumniFacets(rows).batches, ['2021', '2019']);
    const f = {
      search: '',
      batch: [] as string[],
      district: [] as string[],
      sort: 'name' as const,
    };
    assert.deepEqual(
      filterAlumni(rows, f).map((r) => r.id),
      [2, 3, 1],
    );
    assert.deepEqual(
      filterAlumni(rows, { ...f, sort: 'batch' }).map((r) => r.id),
      [2, 3, 1],
    );
    assert.deepEqual(
      filterAlumni(rows, { ...f, search: '0179' }).map((r) => r.id),
      [2],
    );
    assert.deepEqual(
      filterAlumni(rows, { ...f, district: ['Rangpur'], batch: ['2021'] }).map((r) => r.id),
      [3],
    );
    // Several ticked values are OR-ed within a filter, AND-ed across filters.
    const two = filterAlumni(rows, { ...f, batch: rows.slice(0, 2).map((r) => r.batch) });
    assert.ok(two.every((r) => rows.slice(0, 2).some((x) => x.batch === r.batch)));
    assert.ok(two.length >= 2);
    assert.equal(alumniSummary(3, 3, 2, false), '3 alumni · 2 batches');
    assert.equal(alumniSummary(3, 1, 2, true), '1 of 3 alumni');
    assert.equal(
      alumniAddress({ village: 'V', post_office: null, upazila: 'U', district: 'D' }),
      'V, U, D',
    );
  });
});

describe('billing view', () => {
  const base: Subscription = {
    status: 'active',
    plan_name: 'Annual plan',
    access_state: 'active',
    access_ends_at: '2027-01-01T00:00:00.000Z',
    grace_ends_at: null,
    days_remaining: 74,
    grace_days_remaining: 0,
    trial_started_at: null,
    trial_ends_at: null,
    subscription_started_at: '2026-01-01T00:00:00.000Z',
    current_period_started_at: '2026-01-01T00:00:00.000Z',
    current_period_ends_at: '2027-01-01T00:00:00.000Z',
    cancelled_at: null,
  };
  it('uses the shared visible fields and drops a duplicate "Access ends"', async () => {
    const { SUBSCRIPTION_STATUS_FIELDS, SUBSCRIPTION_DATE_FIELD_LABELS } = await shared();
    const v = billingView(base, SUBSCRIPTION_STATUS_FIELDS, SUBSCRIPTION_DATE_FIELD_LABELS);
    assert.equal(
      v.dates.some((d) => d.label === 'Access ends'),
      false,
    );
    assert.equal(v.showRenewal, true);
    assert.equal(v.days, '74');
    assert.equal(v.subtitle, 'Active · Annual plan · Access open');
    const locked = billingView(
      { ...base, status: 'suspended', access_state: 'locked' },
      SUBSCRIPTION_STATUS_FIELDS,
      SUBSCRIPTION_DATE_FIELD_LABELS,
    );
    assert.equal(locked.days, '—');
    assert.equal(locked.showAccessEnds, false);
    const grace = billingView(
      { ...base, status: 'past_due', access_state: 'grace', grace_days_remaining: 6 },
      SUBSCRIPTION_STATUS_FIELDS,
      SUBSCRIPTION_DATE_FIELD_LABELS,
    );
    assert.equal(grace.daysLabel, 'Grace days left');
    assert.equal(grace.days, '6');
  });
  it('formats dates', () => {
    assert.equal(formatBillingDate('2026-10-04T12:00:00'), '4 Oct 2026');
    assert.equal(formatBillingDate(null), 'Not set');
    assert.equal(formatBillingDate('nope'), 'Not set');
  });
});

describe('row selection', () => {
  it('toggles rows and the page, keeps only present ids', () => {
    let s = toggleId(new Set(), 1);
    s = toggleId(s, 2);
    assert.deepEqual([...toggleId(s, 1)], [2]);
    assert.deepEqual(pageState(s, [1, 2, 3]), { all: false, some: true });
    s = togglePage(s, [1, 2, 3]);
    assert.deepEqual(pageState(s, [1, 2, 3]), { all: true, some: false });
    assert.equal(togglePage(s, [1, 2, 3]).size, 0);
    assert.deepEqual([...retainIds(new Set([1, 5]), [1, 2])], [1]);
    assert.equal(sameIds(new Set([1, 2]), new Set([2, 1])), true);
    assert.equal(pageState(new Set(), []).all, false);
  });
});

describe('qr', () => {
  it('builds a square matrix with finder patterns and an SVG path', () => {
    const m = qrMatrix('https://demo.school.test/join?code=ABCD-EFGH');
    assert.equal(m.dark.length, m.size * m.size);
    assert.ok(m.size >= 21);
    // Top-left finder pattern: a 7×7 dark ring.
    for (let i = 0; i < 7; i++) {
      assert.equal(m.dark[i], true);
      assert.equal(m.dark[i * m.size], true);
    }
    const d = qrPath(m, 2);
    assert.match(d, /^M2 2h1v1h-1z/);
    assert.equal(d.split('M').length - 1, m.dark.filter(Boolean).length);
  });
});

describe('holiday calendar', () => {
  const h = (id: number, start: string, end: string, is_optional = false) =>
    ({
      id,
      title: `H${id}`,
      start_date: start,
      end_date: end,
      description: '',
      is_optional,
    }) as Holiday;
  const list = [h(1, '2026-03-30', '2026-04-02'), h(2, '2026-04-02', '2026-04-02', true)];
  it('lists holidays on a date and marks every day of a range in the month', () => {
    assert.deepEqual(
      holidaysOn(list, '2026-04-02').map((x) => x.id),
      [1, 2],
    );
    assert.deepEqual(holidaysOn(list, '2026-04-03'), []);
    assert.deepEqual([...holidayDaysInMonth(list, 2026, 3)], ['2026-04-01', '2026-04-02']);
    assert.deepEqual([...holidayDaysInMonth(list, 2026, 2)], ['2026-03-30', '2026-03-31']);
  });
});

describe('staff', () => {
  const s = (o: Partial<StaffRow>) =>
    ({
      id: 1,
      name: 'X',
      email: null,
      phone: '017',
      designation: null,
      address: null,
      image: null,
      ...o,
    }) as StaffRow;
  const rows = [
    s({ id: 1, name: 'Rafi', designation: 'Peon', phone: '01711111111' }),
    s({ id: 2, name: 'Ali', designation: 'Clerk', email: 'ali@x.test' }),
    s({ id: 3, name: 'Mitu', designation: 'Peon' }),
  ];
  it('stats, designations and filters', () => {
    assert.equal(staffStats(rows).total, 3);
    assert.deepEqual(staffDesignations(rows), ['Clerk', 'Peon']);
    assert.deepEqual(
      filterStaff(rows, { search: '', designation: 'Peon' }).map((r) => r.id),
      [3, 1],
    );
    assert.deepEqual(
      filterStaff(rows, { search: 'ali@', designation: '' }).map((r) => r.id),
      [2],
    );
    assert.deepEqual(
      filterStaff(rows, { search: '0171', designation: '' }).map((r) => r.id),
      [1],
    );
    // multi-select with a "Not set" bucket, and the address is searchable
    const withNone = [...rows, s({ id: 4, name: 'Zed', designation: null, address: 'Panchbibi' })];
    assert.deepEqual(
      filterStaff(withNone, { search: '', designations: ['Not set'] }).map((r) => r.id),
      [4],
    );
    assert.deepEqual(
      filterStaff(withNone, { search: '', designations: ['Clerk', 'Not set'] }).map((r) => r.id),
      [2, 4],
    );
    assert.deepEqual(
      filterStaff(withNone, { search: 'panch' }).map((r) => r.id),
      [4],
    );
  });
  it('validates with the shared staffFormSchema and maps to the API input', async () => {
    const { staffFormSchema } = await shared();
    const bad = staffFormSchema.safeParse({ ...staffDefaults(), phone: '123' });
    assert.equal(bad.success, false);
    if (!bad.success) {
      const e = issuesToErrors(bad.error.issues);
      assert.ok(e.name);
      assert.ok(e.phone);
    }
    const good = staffFormSchema.safeParse({
      ...staffDefaults(),
      name: 'Rafi Uddin',
      phone: '01711111111',
    });
    assert.equal(good.success, true);
    if (good.success) {
      const input = toStaffInput(good.data as Parameters<typeof toStaffInput>[0]);
      assert.equal(input.name, 'Rafi Uddin');
      assert.equal('school_id' in input, false);
    }
    assert.equal(staffDefaults(rows[1]).email, 'ali@x.test');
  });
});
