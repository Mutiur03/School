import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { LedgerQueryDto, ReportQueryDto } from './report-query.dto.js';

// Same options as the global pipe in bootstrap.ts (no `transform`), applied to query strings.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (query: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(query, { type: 'query', metatype });

describe('ReportQueryDto', () => {
  it.each([[{}], [{ from: '2026-01-01' }], [{ from: '2026-01-01', to: '2026-12-31' }]])(
    'accepts %j',
    async (q) => {
      await expect(run(q, ReportQueryDto)).resolves.toEqual(q);
    },
  );

  it.each([[{ from: 'not-a-date' }], [{ to: '2026-13-45' }], [{ school_id: '2' }]])(
    'rejects %j → 400',
    async (q) => {
      await expect(run(q, ReportQueryDto)).rejects.toMatchObject({ status: 400 });
    },
  );
});

describe('LedgerQueryDto', () => {
  it('parses head_id query string to number', async () => {
    await expect(run({ head_id: '7', from: '2026-01-01' }, LedgerQueryDto)).resolves.toEqual({
      head_id: 7,
      from: '2026-01-01',
    });
  });

  it.each([[{}], [{ head_id: 'abc' }], [{ head_id: '1.5' }], [{ head_id: '1', foo: 'x' }]])(
    'rejects %j → 400',
    async (q) => {
      await expect(run(q, LedgerQueryDto)).rejects.toMatchObject({ status: 400 });
    },
  );
});
