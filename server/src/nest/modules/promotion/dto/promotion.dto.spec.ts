import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { PassRulesDto } from './pass-rules.dto.js';
import { UpdateEnrollmentStatusDto } from './update-enrollment-status.dto.js';

// Same options as the global pipe in bootstrap.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

describe('PassRulesDto', () => {
  it.each([
    [{}],
    [{ rules: 'x' }],
    [{ rules: [{ class: 5, max_failed: 0 }] }],
    [{ rules: [{ class: 6, max_failed: -1 }] }],
    [{ rules: [{ class: 6, max_failed: 16 }] }],
    [{ rules: [{ class: 6, max_failed: 1.5 }] }],
    [{ rules: [{ class: 6 }] }],
    [{ rules: [{ class: 6, max_failed: 1, school_id: 2 }] }],
    [{ rules: [], year: 2026 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, PassRulesDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [{ rules: [] }],
    [
      {
        rules: [
          { class: 6, max_failed: 0 },
          { class: 10, max_failed: 15 },
        ],
      },
    ],
  ])('accepts %j', async (body) => {
    await expect(run(body, PassRulesDto)).resolves.toMatchObject(body);
  });
});

describe('UpdateEnrollmentStatusDto', () => {
  it.each([[{}], [{ status: 'Promoted' }], [{ status: 'Passed', id: 1 }]])(
    'rejects %j → 400',
    async (body) => {
      await expect(run(body, UpdateEnrollmentStatusDto)).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each([['Passed'], ['Failed'], ['Pending'], ['Graduated']])('accepts %s', async (status) => {
    await expect(run({ status }, UpdateEnrollmentStatusDto)).resolves.toEqual({ status });
  });
});
