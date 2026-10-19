/**
 * Batch 6 clients: site PDFs, certificates, admissions, gallery and registrations. Exact paths,
 * methods and bodies (verified against server/src/modules/{citizen-charter,class-routine,syllabus,
 * admission,gallery,registration} and the Nest certificate controller), uploads going to the
 * presigned URL with no credentials, and no school id ever sent.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAdmissionApi, parseAdmissionSettings } from './admission';
import { certificateQuery, createCertificatesApi } from './certificates';
import { createApiClient } from './client';
import { createGalleryApi, parseGalleryGroups, placementError, uploader } from './gallery';
import { parseSessionMarksheet, sessionMarkHeads } from './promotions';
import { createRegistrationApi, REG_CONFIG, regSettingsBody, reusableKey } from './registration';
import { createSiteDocsApi } from './site-docs';
import type { PickedFile } from './uploads';

type Call = { url: string; method: string; body: unknown; credentials?: string };

const legacy = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ statusCode: status, success: true, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const raw = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function harness(respond: (c: Call) => Response = () => legacy(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const b = init?.body;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof b === 'string' ? JSON.parse(b) : b,
      credentials: init?.credentials,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
  });
  return { calls, client, fetchImpl };
}

const path = (c: Call) => new URL(c.url).pathname;
const query = (c: Call) => Object.fromEntries(new URL(c.url).searchParams);
function noSchoolId(calls: Call[]) {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object' && !(v instanceof Blob)) {
      assert.equal('school_id' in v, false);
      Object.values(v).forEach(walk);
    }
  };
  for (const c of calls) {
    assert.equal(new URL(c.url).searchParams.has('school_id'), false);
    walk(c.body);
  }
}
const file = (name: string, type: string, size = 10): PickedFile => ({
  name,
  type,
  size,
  body: new Blob(['x'], { type }),
});
const presigned = { uploadUrl: 'https://r2.test/put?sig=1', key: 'schools/7/k.pdf' };

describe('site documents', () => {
  it('charter: 404 means none; upload presigns, PUTs to R2, then saves the key', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : path(c).endsWith('/presigned-url')
          ? legacy(presigned)
          : c.method === 'GET'
            ? legacy(null, 404)
            : legacy({}),
    );
    const api = createSiteDocsApi(h.client, h.fetchImpl);
    assert.equal(await api.charter(), null);
    await api.uploadCharter(file('c.pdf', 'application/pdf'));
    const [, presign, put, save] = h.calls;
    assert.equal(path(presign!), '/api/citizen-charter/presigned-url');
    assert.equal(query(presign!).contentType, 'application/pdf');
    assert.equal(put!.method, 'PUT');
    assert.equal(put!.credentials, 'omit');
    assert.deepEqual(
      [save!.method, path(save!), save!.body],
      ['POST', '/api/citizen-charter', { key: presigned.key }],
    );
    noSchoolId(h.calls);
  });

  it('rejects a non-PDF before any request', async () => {
    const h = harness();
    const api = createSiteDocsApi(h.client, h.fetchImpl);
    await assert.rejects(api.uploadCharter(file('a.png', 'image/png')), /must be a PDF/);
    assert.equal(h.calls.length, 0);
  });

  it('routine replaces with PUT when one exists, deletes by id', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : path(c).endsWith('/presigned-url')
          ? legacy(presigned)
          : legacy([{ id: 4, pdf_url: 'schools/7/r.pdf', created_at: '2026-01-02T00:00:00Z' }]),
    );
    const api = createSiteDocsApi(h.client, h.fetchImpl);
    const current = await api.routine();
    assert.equal(current?.id, 4);
    await api.uploadRoutine(file('r.pdf', 'application/pdf'), current);
    await api.removeRoutine(4);
    const save = h.calls[3]!;
    assert.deepEqual(
      [save.method, path(save), save.body],
      ['PUT', '/api/class-routine/pdf/4', { key: presigned.key }],
    );
    assert.deepEqual(
      [h.calls[4]!.method, path(h.calls[4]!)],
      ['DELETE', '/api/class-routine/pdf/4'],
    );
  });

  it('syllabus edit without a new file sends no key; a new row needs a file', async () => {
    const h = harness(() => legacy({}));
    const api = createSiteDocsApi(h.client, h.fetchImpl);
    await api.saveSyllabus(9, { class: 7, year: 2026, file: null });
    assert.deepEqual(
      [h.calls[0]!.method, path(h.calls[0]!), h.calls[0]!.body],
      ['PUT', '/api/syllabus/9', { class: 7, year: 2026 }],
    );
    await assert.rejects(api.saveSyllabus(null, { class: 7, year: 2026, file: null }), /PDF/);
    assert.equal(h.calls.length, 1);
  });
});

describe('certificates', () => {
  it('sends edits/status only when exactly one is ticked; exam/year as comma lists', () => {
    assert.deepEqual(
      certificateQuery({
        page: 2,
        limit: 50,
        exam: ['SSC', '8'],
        year: ['2024'],
        edits: ['edited', 'never'],
        status: ['pending'],
        name: '  Rahim ',
      }),
      { page: 2, limit: 50, exam: 'SSC,8', year: '2024', status: 'pending', name: 'Rahim' },
    );
  });

  it('pdf adds address=false only without the address; status PATCH; ids encoded', async () => {
    const h = harness(() => new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 }));
    const api = createCertificatesApi(h.client);
    await api.pdf('a/b', false);
    await api.pdf('a/b', true);
    assert.equal(path(h.calls[0]!), '/api/admin/certificates/a%2Fb/pdf');
    assert.deepEqual(query(h.calls[0]!), { address: 'false' });
    assert.deepEqual(query(h.calls[1]!), {});
    const h2 = harness(() => legacy(null));
    await createCertificatesApi(h2.client).setStatus('x', 'approved');
    assert.deepEqual(
      [h2.calls[0]!.method, path(h2.calls[0]!), h2.calls[0]!.body],
      ['PATCH', '/api/admin/certificates/x/status', { status: 'approved' }],
    );
  });
});

describe('admissions', () => {
  it('parses the raw settings row (snake and camel case) and its notice', () => {
    const s = parseAdmissionSettings({
      admission_year: 2026,
      admission_open: true,
      classList: 'Six, Seven',
      user_id_class6: '1,2',
      preview_url: 'schools/7/n.pdf',
    });
    assert.equal(s?.year, 2026);
    assert.equal(s?.values.admission_year, '2026');
    assert.equal(s?.values.class_list, 'Six, Seven');
    assert.equal(s?.values.user_id_class6, '1,2');
    assert.equal(s?.notice, 'schools/7/n.pdf');
    assert.equal(parseAdmissionSettings(null), null);
  });

  it('settings save drops a stale notice_key and adds the freshly uploaded one', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : path(c) === '/api/admission/upload-url'
          ? legacy(presigned)
          : legacy({}),
    );
    const api = createAdmissionApi(h.client, h.fetchImpl);
    await api.saveSettings({ admission_year: 2026, notice_key: 'evil' }, null);
    assert.deepEqual(h.calls[0]!.body, { admission_year: 2026 });
    await api.saveSettings({ admission_year: 2026 }, file('n.pdf', 'application/pdf'));
    assert.deepEqual(h.calls[1]!.body, { filename: 'n.pdf', filetype: 'application/pdf' });
    assert.deepEqual(
      [h.calls[3]!.method, h.calls[3]!.body],
      ['PUT', { admission_year: 2026, notice_key: presigned.key }],
    );
    noSchoolId(h.calls);
  });

  it('list query: one status = filter, two = all; exports reuse the filters', async () => {
    const h = harness(() =>
      legacy({
        data: [{ id: 'u1', student_name_en: 'A', status: 'pending' }],
        meta: { total: 1, pending: 1, totalPages: 1 },
      }),
    );
    const api = createAdmissionApi(h.client);
    const list = await api.forms({
      page: 1,
      limit: 50,
      status: ['pending', 'approved'],
      cls: 'Six',
      year: '2026',
      search: ' x ',
    });
    assert.equal(list.rows[0]!.id, 'u1');
    assert.deepEqual(query(h.calls[0]!), {
      page: '1',
      limit: '50',
      status: 'all',
      class: 'Six',
      admission_year: '2026',
      search: 'x',
    });
    const h2 = harness(() => new Response(new Uint8Array([1]), { status: 200 }));
    await createAdmissionApi(h2.client).exportExcel({
      status: ['approved'],
      cls: '',
      year: '',
      search: '',
    });
    assert.equal(path(h2.calls[0]!), '/api/admission/form/excel');
    assert.deepEqual(query(h2.calls[0]!), { status: 'approved' });
  });

  it('status uses /approve or /pending; delete by id', async () => {
    const h = harness(() => legacy(null));
    const api = createAdmissionApi(h.client);
    await api.setStatus('7', 'approved');
    await api.setStatus('7', 'pending');
    await api.removeForm('7');
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${path(c)}`),
      [
        'PUT /api/admission/form/7/approve',
        'PUT /api/admission/form/7/pending',
        'DELETE /api/admission/form/7',
      ],
    );
  });

  it('result upload: init, PUT each PDF, then save the keys under their list type', async () => {
    const h = harness((c) => {
      if (c.url.startsWith('https://r2.test')) return new Response(null, { status: 200 });
      if (path(c) === '/api/admission-result/upload')
        return raw({
          success: true,
          data: [
            {
              type: 'merit_list',
              success: true,
              mode: 'simple',
              uploadUrl: 'https://r2.test/a',
              key: 'k/m.pdf',
            },
            {
              type: 'waiting_list_2',
              success: true,
              mode: 'simple',
              uploadUrl: 'https://r2.test/b',
              key: 'k/w2.pdf',
            },
          ],
        });
      return legacy({});
    });
    const api = createAdmissionApi(h.client, h.fetchImpl);
    await api.saveResult(3, {
      class_name: '6',
      admission_year: 2026,
      files: {
        merit_list: file('m.pdf', 'application/pdf'),
        waiting_list_2: file('w.pdf', 'application/pdf'),
      },
    });
    const init = h.calls[0]!;
    assert.deepEqual(init.body, {
      files: [
        { filename: 'm.pdf', contentType: 'application/pdf', fileSize: 10, type: 'merit_list' },
        { filename: 'w.pdf', contentType: 'application/pdf', fileSize: 10, type: 'waiting_list_2' },
      ],
      className: '6',
      admissionYear: 2026,
    });
    const save = h.calls[3]!;
    assert.deepEqual(
      [save.method, path(save), save.body],
      [
        'PUT',
        '/api/admission-result/3',
        {
          class_name: '6',
          admission_year: 2026,
          merit_list: 'k/m.pdf',
          waiting_list_2: 'k/w2.pdf',
        },
      ],
    );
  });

  it('result upload: a failed init (success:false), a bad multipart reply or a huge file stops before saving', async () => {
    const h = harness(() => raw({ success: false, data: [] }));
    const api = createAdmissionApi(h.client, h.fetchImpl);
    await assert.rejects(
      api.saveResult(null, {
        class_name: '6',
        admission_year: 2026,
        files: { merit_list: file('m.pdf', 'application/pdf') },
      }),
    );
    assert.equal(h.calls.length, 1);
    const h2 = harness(() =>
      raw({
        success: true,
        data: [{ type: 'merit_list', success: true, mode: 'multipart', uploadId: '', key: 'k' }],
      }),
    );
    await assert.rejects(
      createAdmissionApi(h2.client, h2.fetchImpl).saveResult(null, {
        class_name: '6',
        admission_year: 2026,
        files: { merit_list: file('m.pdf', 'application/pdf') },
      }),
      /prepare the upload/,
    );
    assert.equal(h2.calls.length, 1);
    await assert.rejects(
      createAdmissionApi(h2.client).saveResult(null, {
        class_name: '6',
        admission_year: 2026,
        files: { merit_list: file('m.pdf', 'application/pdf', 6 * 1024 ** 3) },
      }),
      /larger than 5 GB/,
    );
    await assert.rejects(
      createAdmissionApi(h2.client).saveResult(null, {
        class_name: '6',
        admission_year: 2026,
        files: {},
      }),
      /at least one/,
    );
    assert.equal(h2.calls.length, 1);
  });

  it('result upload: multipart signs, PUTs each part, keeps ETags and completes', async () => {
    const MB = 1024 * 1024;
    const h = harness((c) => {
      const p = new URL(c.url);
      if (p.pathname === '/api/admission-result/upload')
        return raw({
          success: true,
          data: [
            {
              type: 'merit_list',
              success: true,
              mode: 'multipart',
              key: '1/admission/m.pdf',
              uploadId: 'up-1',
              chunkSize: 10 * MB,
              endpoints: { signPart: 'https://evil.test/sign', complete: 'https://evil.test/done' },
            },
          ],
        });
      if (p.pathname === '/api/admission-result/multipart/sign-part') {
        const n = (c.body as { partNumber: number }).partNumber;
        return raw({ success: true, url: `https://r2.test/part-${n}` });
      }
      if (p.host === 'r2.test')
        return new Response(null, {
          status: 200,
          headers: { ETag: `"etag-${p.pathname.slice(6)}"` },
        });
      if (p.pathname === '/api/admission-result/multipart/complete')
        return raw({ success: true, key: '1/admission/m.pdf' });
      return legacy({});
    });
    const labels: string[] = [];
    await createAdmissionApi(h.client, h.fetchImpl).saveResult(
      null,
      {
        class_name: '6',
        admission_year: 2026,
        files: { merit_list: file('m.pdf', 'application/pdf', 25 * MB) },
      },
      (l) => labels.push(l),
    );
    const paths = h.calls.map(
      (c) => `${c.method} ${new URL(c.url).host === 'r2.test' ? c.url : path(c)}`,
    );
    assert.deepEqual(paths, [
      'POST /api/admission-result/upload',
      'POST /api/admission-result/multipart/sign-part',
      'PUT https://r2.test/part-1',
      'POST /api/admission-result/multipart/sign-part',
      'PUT https://r2.test/part-2',
      'POST /api/admission-result/multipart/sign-part',
      'PUT https://r2.test/part-3',
      'POST /api/admission-result/multipart/complete',
      'POST /api/admission-result',
    ]);
    assert.equal(
      h.calls.some((c) => c.url.includes('evil.test')),
      false,
    );
    assert.equal(h.calls[2]!.credentials, 'omit');
    assert.deepEqual(h.calls[7]!.body, {
      key: '1/admission/m.pdf',
      uploadId: 'up-1',
      parts: [
        { ETag: 'etag-1', PartNumber: 1 },
        { ETag: 'etag-2', PartNumber: 2 },
        { ETag: 'etag-3', PartNumber: 3 },
      ],
    });
    assert.deepEqual(h.calls[8]!.body, {
      class_name: '6',
      admission_year: 2026,
      merit_list: '1/admission/m.pdf',
    });
    assert.deepEqual(labels.slice(-2), ['Uploading m.pdf: 100%', 'Saving changes…']);
    noSchoolId(h.calls);
  });

  it('result upload: a part without an ETag aborts before complete', async () => {
    const h = harness((c) => {
      const p = new URL(c.url);
      if (p.pathname === '/api/admission-result/upload')
        return raw({
          success: true,
          data: [{ type: 'merit_list', success: true, mode: 'multipart', key: 'k', uploadId: 'u' }],
        });
      if (p.pathname.endsWith('/sign-part'))
        return raw({ success: true, url: 'https://r2.test/p' });
      return new Response(null, { status: 200 });
    });
    await assert.rejects(
      createAdmissionApi(h.client, h.fetchImpl).saveResult(null, {
        class_name: '6',
        admission_year: 2026,
        files: { merit_list: file('m.pdf', 'application/pdf', 60 * 1024 * 1024) },
      }),
      /Missing ETag/,
    );
    assert.equal(
      h.calls.some((c) => c.url.includes('complete')),
      false,
    );
  });
});

describe('gallery', () => {
  const grouped = {
    events: {
      'Sports Day': [
        { id: 2, image_path: 'g/2.jpg', event_id: 5, created_at: '2026-02-01' },
        { id: 3, image_path: 'g/3.jpg', event_id: 5, created_at: '2026-03-01' },
      ],
    },
    categories: {
      Campus: [
        { id: 9, image_path: 'g/9.jpg', category_id: 4, student_name: 'Rafi', student_batch: 2025 },
      ],
    },
  };

  it('groups events first, newest photo first, with the album id for thumbnails', () => {
    const g = parseGalleryGroups(grouped, '/x');
    assert.deepEqual(
      g.map((x) => [x.id, x.refId, x.images.map((i) => i.id)]),
      [
        ['event:Sports Day', 5, [3, 2]],
        ['category:Campus', 4, [9]],
      ],
    );
    assert.equal(uploader(g[1]!.images[0]!), 'Rafi (Batch 2025)');
    assert.equal(uploader(g[0]!.images[0]!), 'Admin');
  });

  it('placement rules match the web form', () => {
    assert.match(placementError({ eventId: '', categoryId: '' })!, /category or an event/);
    assert.match(placementError({ eventId: '', categoryId: '1' })!, /event/);
    assert.equal(placementError({ eventId: '5', categoryId: '' }), null);
  });

  it('upload: presign each image, then one POST filed under the events category', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : path(c) === '/api/gallery/presigned-url'
          ? legacy({ uploadUrl: 'https://r2.test/p', key: `g/${h.calls.length}.jpg` })
          : legacy({ count: 2 }),
    );
    const api = createGalleryApi(h.client, h.fetchImpl);
    const n = await api.upload([file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')], ' Hi ', {
      eventId: '5',
      categoryId: '',
    });
    assert.equal(n, 2);
    const post = h.calls.at(-1)!;
    assert.deepEqual(
      [post.method, path(post), post.body],
      [
        'POST',
        '/api/gallery/upload',
        {
          keys: ['g/1.jpg', 'g/3.jpg'],
          caption: 'Hi',
          eventId: '5',
          category: '1',
          status: 'approved',
        },
      ],
    );
    noSchoolId(h.calls);
  });

  it('rejects oversized / non-image files before any request', async () => {
    const h = harness();
    const api = createGalleryApi(h.client, h.fetchImpl);
    await assert.rejects(
      api.upload([file('a.pdf', 'application/pdf')], '', { eventId: '5', categoryId: '' }),
      /not an image/,
    );
    await assert.rejects(
      api.upload([file('a.jpg', 'image/jpeg', 6 * 1024 * 1024)], '', {
        eventId: '5',
        categoryId: '',
      }),
      /5 MB/,
    );
    assert.equal(h.calls.length, 0);
  });

  it('single vs bulk endpoints, thumbnails by album kind', async () => {
    const h = harness(() => raw({ ok: true }));
    const api = createGalleryApi(h.client);
    await api.reject([1]);
    await api.reject([1, 2]);
    await api.remove([3]);
    await api.remove([3, 4]);
    await api.approve([5, 6]);
    const [ev, cat] = parseGalleryGroups(grouped, '/x');
    await api.setThumbnail(ev!, 3);
    await api.setThumbnail(cat!, 9);
    assert.deepEqual(
      h.calls.map(
        (c) =>
          `${c.method} ${path(c)}${c.body && typeof c.body === 'object' && 'ids' in c.body ? ` ${JSON.stringify(c.body)}` : ''}`,
      ),
      [
        'PATCH /api/gallery/reject/1',
        'POST /api/gallery/rejectMultiple {"ids":[1,2]}',
        'DELETE /api/gallery/deleteGallery/3',
        'POST /api/gallery/deleteMultiple {"ids":[3,4]}',
        'PATCH /api/gallery/approve/5',
        'PATCH /api/gallery/approve/6',
        'PUT /api/gallery/setEventThumbnail/5/3',
        'PUT /api/gallery/setCategoryThumbnail/4/9',
      ],
    );
  });
});

describe('registrations', () => {
  const cfg9 = REG_CONFIG['class-9'];

  it('list query uses the variant year param; one status/section = filter', async () => {
    const h = harness(() => legacy({ data: [], meta: { total: 0, totalPages: 1 } }));
    const api = createRegistrationApi(h.client);
    await api.list(cfg9, {
      page: 1,
      limit: 50,
      year: '2027',
      status: ['approved'],
      sections: ['A', 'B'],
      search: '',
    });
    assert.equal(path(h.calls[0]!), '/api/reg/class-9/form');
    assert.deepEqual(query(h.calls[0]!), {
      page: '1',
      limit: '50',
      ssc_year: '2027',
      status: 'approved',
      section: '',
    });
    await api.export(cfg9, 'photos', { year: '2027', status: [], sections: ['B'], search: 'x' });
    assert.equal(path(h.calls[1]!), '/api/reg/class-9/form/export-photos');
    assert.deepEqual(query(h.calls[1]!), { ssc_year: '2027', status: 'all', section: 'B' });
  });

  it('settings body: year under its field, reg_open as text, enrollment classmates not stored', () => {
    const body = regSettingsBody(
      REG_CONFIG['class-6'],
      {
        year: ' 2026 ',
        reg_open: true,
        a_sec_roll: '01-50',
        b_sec_roll: '',
        instruction_for_a: 'a',
        instruction_for_b: 'b',
        attachment_instruction: 'c',
        classmates: 'resolved, names',
        classmates_source: 'default',
      },
      'schools/7/n.pdf',
    );
    assert.deepEqual(body, {
      a_sec_roll: '01-50',
      b_sec_roll: '',
      class6_year: '2026',
      reg_open: 'true',
      instruction_for_a: 'a',
      instruction_for_b: 'b',
      attachment_instruction: 'c',
      classmates_source: 'default',
      classmates: '',
      notice_key: 'schools/7/n.pdf',
    });
    assert.equal(reusableKey('https://cdn.test/x.pdf'), null);
    assert.equal(reusableKey('schools/7/x.pdf'), 'schools/7/x.pdf');
  });

  it('saving keeps the current notice (the server would clear it otherwise)', async () => {
    const h = harness(() => legacy({}));
    const api = createRegistrationApi(h.client);
    const input = {
      year: '2026',
      reg_open: false,
      a_sec_roll: '',
      b_sec_roll: '',
      instruction_for_a: '',
      instruction_for_b: '',
      attachment_instruction: '',
      classmates: '',
      classmates_source: 'default' as const,
    };
    await api.saveSettings(REG_CONFIG['class-8'], input, null, 'schools/7/old.pdf');
    assert.equal((h.calls[0]!.body as Record<string, unknown>).notice_key, 'schools/7/old.pdf');
    await assert.rejects(
      api.saveSettings(REG_CONFIG['class-8'], { ...input, year: '26' }, null, null),
      /4-digit/,
    );
    await api.removeNotice(REG_CONFIG['junior-scholarship'], '2026');
    assert.deepEqual(
      [h.calls[1]!.method, path(h.calls[1]!), query(h.calls[1]!)],
      ['DELETE', '/api/reg/junior-scholarship/notice', { jse_year: '2026' }],
    );
    noSchoolId(h.calls);
  });

  it('status is PUT /form/:id/status with the status in the body', async () => {
    const h = harness(() => legacy(null));
    await createRegistrationApi(h.client).setStatus(REG_CONFIG['class-6'], '12', 'approved');
    assert.deepEqual(
      [h.calls[0]!.method, path(h.calls[0]!), h.calls[0]!.body],
      ['PUT', '/api/reg/class-6/form/12/status', { status: 'approved' }],
    );
  });
});

describe('session marksheet preview', () => {
  it('parses rows, shows "-" for missing marks and formats the GPA', () => {
    const m = parseSessionMarksheet(
      {
        student: { name: 'A', class: 8, section: 'B', roll: 3, year: 2026 },
        previous_exam_name: 'Half yearly',
        year_end_exam_name: 'Annual',
        split: true,
        examRows: [
          {
            subject: 'Math',
            marks: ['40', null, '40'],
            fullMark: 100,
            passMark: 33,
            grade: 'A',
            gp: 4,
          },
        ],
        continuousRows: [],
        totals: ['40', '-', '40'],
        grand_total: 40,
        gpa: 4,
        is_failed: false,
        fail_count: 0,
        position: 0,
      },
      '/x',
    )!;
    assert.deepEqual(m.examRows[0]!.marks, ['40', '-', '40']);
    assert.equal(m.gpa, '4.00');
    assert.equal(m.position, null);
    assert.deepEqual(sessionMarkHeads(m), ['Half yearly', 'Annual', 'Total']);
    assert.equal(parseSessionMarksheet(null, '/x'), null);
  });
});
