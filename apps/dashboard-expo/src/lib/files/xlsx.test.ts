/**
 * The fflate-based .xlsx reader / writer and the picker helpers. Fixtures: the web's real
 * subject template (dashboard/public/subject_upload_demo.xlsx) and a SheetJS-written sheet with a
 * date cell, numbers, booleans, Bangla and XML-escaped text.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { acceptsOnlyImages, documentPickerTypes, mimeFor, nameFor } from './pick-model';
import {
  buildXlsx,
  columnIndex,
  decodeXml,
  isDateFormat,
  MAX_XLSX_BYTES,
  readXlsxRows,
  rowsToObjects,
  serialToIso,
  SpreadsheetError,
} from './xlsx';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));

describe('readXlsxRows', () => {
  it('reads the web subject template like SheetJS (header + every row)', () => {
    const rows = readXlsxRows(fixture('subject-demo.xlsx'));
    assert.equal(rows.length, 65);
    assert.deepEqual(rows[0]!.slice(0, 8), [
      'name',
      'class',
      'full_mark',
      'pass_mark',
      'year',
      'subject_group',
      'assessment_type',
      'priority',
    ]);
    assert.deepEqual(rows[1], [
      'Bangla 1st Paper',
      '6',
      '100',
      '33',
      '2026',
      'Bangla',
      'exam',
      '1',
    ]);
    assert.ok(rows.slice(1).every((r) => r[0] && r[0].length > 0));
  });

  it('turns dates into YYYY-MM-DD and keeps text, numbers and booleans as cell text', () => {
    const rows = readXlsxRows(fixture('sheetjs-sample.xlsx'));
    assert.deepEqual(rows, [
      ['name', 'dob', 'roll', 'father_phone', 'has_stipend', 'note'],
      ['রহিম উদ্দিন', '2008-08-15', '12', '01712345678', 'TRUE', 'a & b <c>'],
      ['Nusrat', '20/01/2007', '5.5', '1912345678', 'FALSE', ''],
    ]);
  });

  it('round-trips the template writer (inline strings, escaping, gaps)', () => {
    const bytes = buildXlsx('Students', [
      ['name', 'note'],
      ['A & "B" <c>', ''],
      ['Line', 'x'],
    ]);
    assert.deepEqual(readXlsxRows(bytes), [
      ['name', 'note'],
      ['A & "B" <c>', ''],
      ['Line', 'x'],
    ]);
  });

  it('rejects non-xlsx data, oversized files and sheets over the row limit', () => {
    assert.throws(() => readXlsxRows(strToU8('name,class\nA,6')), SpreadsheetError);
    assert.throws(() => readXlsxRows(new Uint8Array(MAX_XLSX_BYTES + 1)), /5MB/);
    const tooMany = buildXlsx('S', [['name']]);
    // A sheet whose last row is 10,001 (sparse rows are padded like SheetJS).
    const sheet =
      '<worksheet><sheetData><row r="10001"><c r="A10001" t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>';
    const files: Record<string, Uint8Array> = {
      'xl/workbook.xml': strToU8(
        '<workbook><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    };
    assert.ok(tooMany.length > 0);
    assert.throws(() => readXlsxRows(zipSync(files)), /10000 row limit/);
  });

  it('reads shared strings with rich-text runs and skips phonetic runs', () => {
    const files: Record<string, Uint8Array> = {
      'xl/workbook.xml': strToU8(
        '<workbook><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/sharedStrings.xml': strToU8(
        '<sst><si><r><t>Hel</t></r><r><t xml:space="preserve">lo </t></r><rPh><t>x</t></rPh></si><si><t>B&amp;C</t></si></sst>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c r="B1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row></sheetData></worksheet>',
      ),
    };
    assert.deepEqual(readXlsxRows(zipSync(files)), [['', 'Hello ', 'B&C']]);
  });
});

describe('xlsx helpers', () => {
  it('maps column letters, serials, entities and date formats', () => {
    assert.equal(columnIndex('A1'), 0);
    assert.equal(columnIndex('Z9'), 25);
    assert.equal(columnIndex('AB12'), 27);
    assert.equal(serialToIso(39675), '2008-08-15');
    assert.equal(serialToIso(1), '1900-01-01');
    assert.equal(serialToIso(61), '1900-03-01');
    assert.equal(decodeXml('a &amp; &lt;b&gt; &#2453; _x000D_'), 'a & <b> ক \r');
    assert.equal(isDateFormat('dd/mm/yyyy'), true);
    assert.equal(isDateFormat('[$-409]d-mmm-yy;@'), true);
    assert.equal(isDateFormat('0.00'), false);
    assert.equal(isDateFormat('"Day" 0'), false);
  });

  it('builds objects from the header row and drops blank rows', () => {
    assert.deepEqual(
      rowsToObjects([['Name ', 'Class'], ['A', '6'], ['', ''], ['B']], (h) =>
        h.trim().toLowerCase(),
      ),
      [
        { name: 'A', class: '6' },
        { name: 'B', class: '' },
      ],
    );
  });
});

describe('picker helpers', () => {
  it('uses the photo picker only for image-only accepts', () => {
    assert.equal(acceptsOnlyImages('image/*'), true);
    assert.equal(acceptsOnlyImages('image/png,.jpg'), true);
    assert.equal(acceptsOnlyImages('application/pdf,.pdf'), false);
    assert.equal(acceptsOnlyImages(''), false);
  });

  it('maps accepts to document-picker MIME types', () => {
    assert.deepEqual(documentPickerTypes('application/pdf,.pdf'), ['application/pdf']);
    assert.deepEqual(
      documentPickerTypes(
        '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
      [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ],
    );
    assert.deepEqual(documentPickerTypes(''), ['*/*']);
  });

  it('fills in a type and name when the OS leaves them out', () => {
    assert.equal(mimeFor('notice.PDF', null), 'application/pdf');
    assert.equal(mimeFor('a.jpg', 'image/jpeg'), 'image/jpeg');
    assert.equal(
      mimeFor('sheet.xlsx', 'application/octet-stream'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    assert.equal(mimeFor('blob', undefined), 'application/octet-stream');
    assert.equal(nameFor('file:///cache/ImagePicker/ab%20c.jpg', null), 'ab c.jpg');
    assert.equal(nameFor('content://x/123', null, 5), 'file-5');
    assert.equal(nameFor('file:///x.pdf', ' Routine.pdf '), 'Routine.pdf');
  });
});
