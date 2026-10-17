import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateCostCenterDto } from './create-cost-center.dto.js';
import { UpdateCostCenterDto } from './update-cost-center.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const valid = { name: 'Science Lab' };

describe('CreateCostCenterDto', () => {
  it.each([
    [{}],
    [{ name: '' }],
    [{ name: 'x'.repeat(151) }],
    [{ ...valid, code: 'x'.repeat(21) }],
    [{ ...valid, is_active: 'yes' }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateCostCenterDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([[valid], [{ ...valid, code: 'LAB', is_active: false }]])('accepts %j', async (body) => {
    await expect(run(body, CreateCostCenterDto)).resolves.toMatchObject(body);
  });
});

describe('UpdateCostCenterDto', () => {
  it('accepts partial body', async () => {
    await expect(run({ is_active: false }, UpdateCostCenterDto)).resolves.toMatchObject({
      is_active: false,
    });
  });

  it('rejects unknown fields', async () => {
    await expect(run({ school_id: 2 }, UpdateCostCenterDto)).rejects.toMatchObject({
      status: 400,
    });
  });
});
