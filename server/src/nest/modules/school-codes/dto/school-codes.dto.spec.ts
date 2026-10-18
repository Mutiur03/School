import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateSchoolCodeLookupDto } from './create-school-code-lookup.dto.js';
import { CreateSchoolCodeDto } from './create-school-code.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

describe('CreateSchoolCodeDto', () => {
  it.each([[{}], [{ role_hint: 'teacher' }], [{ expires_at: '2030-01-01T00:00:00Z' }]])(
    'accepts %j',
    async (body) => {
      await expect(run(body, CreateSchoolCodeDto)).resolves.toMatchObject(body);
    },
  );

  it.each([
    [{ role_hint: 'super_admin' }],
    [{ expires_at: 'soon' }],
    [{ school_id: 2 }],
    [{ code: 'ABC-7K4Q' }],
  ])('rejects %j', async (body) => {
    await expect(run(body, CreateSchoolCodeDto)).rejects.toMatchObject({ status: 400 });
  });
});

describe('CreateSchoolCodeLookupDto', () => {
  it('accepts a code string', async () => {
    await expect(run({ code: 'abc-7k4q' }, CreateSchoolCodeLookupDto)).resolves.toEqual({
      code: 'abc-7k4q',
    });
  });

  it.each([[{}], [{ code: 5 }], [{ code: 'x'.repeat(33) }], [{ code: 'ABC-7K4Q', school_id: 1 }]])(
    'rejects %j',
    async (body) => {
      await expect(run(body, CreateSchoolCodeLookupDto)).rejects.toMatchObject({ status: 400 });
    },
  );
});
