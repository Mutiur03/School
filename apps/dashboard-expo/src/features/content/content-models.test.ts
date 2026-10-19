import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdmissionResultRow, GalleryGroup, SyllabusRow } from '@/lib/api';
import {
  addressOf,
  admissionSections,
  formatDateLong,
  formatIncome,
  formatQuota,
  parseClassList,
  registrationSections,
} from './admission-model';
import {
  admissionResultRows,
  admissionResultSummary,
  certificateSummary,
  fieldLabel,
  fileNameOf,
  gallerySummary,
  keepExisting,
  regYearOptions,
  resultYearOptions,
  syllabusSummary,
  syllabusTable,
  syllabusYears,
  toggleAll,
} from './model';
import { regFormValues, regSettingsFormSchema } from './registration-model';

const syl = (id: number, cls: number, year: number): SyllabusRow => ({
  id,
  class: cls,
  year,
  viewKey: `s/${id}.pdf`,
  downloadKey: `s/${id}.pdf`,
  at: '',
});
const res = (id: number, cls: string, year: number, lists: number): AdmissionResultRow => ({
  id,
  class_name: cls,
  admission_year: year,
  merit_list: lists > 0 ? 'm' : null,
  waiting_list_1: lists > 1 ? 'w1' : null,
  waiting_list_2: lists > 2 ? 'w2' : null,
  created_at: '',
});

describe('site documents model', () => {
  it('one syllabus row per class 6–10 for the year', () => {
    const rows = [syl(1, 6, 2026), syl(2, 9, 2026), syl(3, 6, 2025)];
    assert.deepEqual(
      syllabusTable(rows, 2026).map((r) => [r.cls, r.row?.id ?? null]),
      [
        [6, 1],
        [7, null],
        [8, null],
        [9, 2],
        [10, null],
      ],
    );
    assert.equal(syllabusSummary(rows, 2026), '2 of 5 classes uploaded for 2026');
    assert.deepEqual(syllabusYears([syl(4, 6, 2020)], 2026), [2027, 2026, 2025, 2020]);
  });

  it('file names drop the upload timestamp', () => {
    assert.equal(fileNameOf('schools/7/syllabus/1712345678901-class%206.pdf'), 'class 6.pdf');
    assert.equal(fileNameOf('https://cdn.test/a/b/routine.pdf?x=1'), 'routine.pdf');
  });
});

describe('certificates model', () => {
  it('summary hides zero pending and shows "N of M" when filtered', () => {
    const meta = {
      total: 3,
      page: 1,
      totalPages: 1,
      totalAll: 10,
      editedCount: 2,
      pendingCount: 0,
      exams: [],
      years: [],
    };
    assert.equal(certificateSummary(meta, true), '3 of 10 certificates · 2 edited');
    assert.equal(
      certificateSummary({ ...meta, pendingCount: 4 }, false),
      '10 certificates · 4 pending · 2 edited',
    );
  });
  it('field labels', () => {
    assert.equal(fieldLabel('father_name_bn'), 'Father name (BN)');
    assert.equal(fieldLabel('address_post_code'), 'Post code');
    assert.equal(fieldLabel('dob'), 'Date of birth');
    assert.equal(fieldLabel('birth_reg_no'), 'Birth registration no.');
  });
});

describe('admission model', () => {
  it('labels quota and income, formats dates without timezone shifts', () => {
    assert.equal(formatQuota(' FF '), 'মুক্তিযোদ্ধার সন্তান (FF)');
    assert.equal(formatQuota('Other'), 'Other');
    assert.equal(formatIncome('50000_100000'), '50,000 - 100,000');
    assert.equal(formatIncome('1000000_x'), '1,000,000 x');
    assert.equal(formatDateLong('05/12/2015'), '5 December 2015');
    assert.equal(formatDateLong('2015-01-31T18:00:00Z'), '31 January 2015');
    assert.equal(formatDateLong('soon'), 'soon');
  });
  it('class list: comma list or first column per line', () => {
    assert.deepEqual(parseClassList('Six, Seven;Eight'), ['Six', 'Seven', 'Eight']);
    assert.deepEqual(parseClassList('Six, 120\nSeven, 80\n'), ['Six', 'Seven']);
    assert.deepEqual(parseClassList(''), []);
  });
  it('address and guardian fallback', () => {
    const f = {
      present_village_road: 'Rd 1',
      present_post_office: 'PO',
      present_post_code: '1200',
      present_district: 'Dhaka',
    };
    assert.equal(addressOf(f, 'present'), 'Rd 1, PO-1200, Dhaka');
    const sections = admissionSections(f);
    assert.deepEqual(
      sections.map(([t]) => t),
      ['Admission', 'Personal', 'Parents', 'Address', 'Previous school', 'Guardian'],
    );
    assert.deepEqual(sections[5]![1], [['Guardian', 'Parents (no separate guardian)']]);
  });
  it('result rows: one per record, empty classes still listed; summary counts PDFs', () => {
    const rows = [res(1, '6', 2026, 3), res(2, '6', 2026, 1), res(3, '8', 2025, 1)];
    assert.deepEqual(
      admissionResultRows(rows, 2026).map((r) => [r.cls, r.result?.id ?? null]),
      [
        ['6', 1],
        ['6', 2],
        ['7', null],
        ['8', null],
        ['9', null],
      ],
    );
    assert.equal(admissionResultSummary(rows, 2026), '1 of 4 classes published · 4 PDFs');
    assert.deepEqual(resultYearOptions(rows, 2026, 2030), [2030, 2026, 2025, 2024]);
  });
});

describe('registration model', () => {
  it('variant-specific education rows', () => {
    const f = {
      group_class_nine: 'Science',
      class6_board: 'Dhaka',
      prev_school_passing_year: '2025',
    };
    const edu = (v: Parameters<typeof registrationSections>[0]) =>
      registrationSections(v, f)
        .find(([t]) => t === 'Education')![1]
        .map(([l]) => l);
    assert.ok(edu('class-9').includes('Group'));
    assert.ok(edu('class-8').includes('Class 6 board'));
    assert.ok(edu('junior-scholarship').includes('Class 6 board'));
    assert.ok(edu('class-6').includes('Passing year'));
    const personal = registrationSections('class-6', {}).find(([t]) => t === 'Personal')![1];
    assert.deepEqual(
      personal.find(([l]) => l === 'Scout'),
      ['Scout', 'No'],
    );
  });
  it('year options and form validation', () => {
    assert.deepEqual(
      regYearOptions(2026, ['2019', '', null]),
      [2026, 2025, 2024, 2023, 2022, 2021, 2019],
    );
    assert.equal(regYearOptions(2026, [], true)[0], 2027);
    const v = regFormValues(undefined, '2026');
    assert.equal(regSettingsFormSchema.safeParse(v).success, true);
    assert.equal(regSettingsFormSchema.safeParse({ ...v, year: '26' }).success, false);
    assert.equal(regSettingsFormSchema.safeParse({ ...v, a_sec_roll: '1 to 50' }).success, false);
  });
});

describe('gallery model', () => {
  const groups: GalleryGroup[] = [
    { id: 'event:A', kind: 'event', title: 'A', refId: 1, images: [{ id: 1 }, { id: 2 }] as never },
    { id: 'category:B', kind: 'category', title: 'B', refId: 2, images: [{ id: 3 }] as never },
  ];
  it('summaries per mode', () => {
    assert.equal(gallerySummary(groups, 'approved'), '3 photos · 1 event · 1 category');
    assert.equal(gallerySummary(groups, 'pending'), '3 photos waiting for review · 2 albums');
    assert.equal(gallerySummary([], 'rejected'), '0 photos rejected · 0 albums');
  });
  it('select-all toggles and pruning after a refetch', () => {
    const on = toggleAll(new Set([1]), [1, 2]);
    assert.deepEqual([...on].sort(), [1, 2]);
    assert.deepEqual([...toggleAll(on, [1, 2])], []);
    assert.deepEqual([...keepExisting(new Set([2, 99]), groups)], [2]);
  });
});
