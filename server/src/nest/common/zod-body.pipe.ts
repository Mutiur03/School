import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '@/utils/ApiError.js';

/**
 * `@Body(new ZodBodyPipe(schema))` for bodies already defined as zod schemas in
 * `@school/shared-schemas` (the forms validate with the same schema). Same 400 as the legacy
 * `validate()` middleware; the body becomes the parsed (trimmed/coerced) data.
 */
@Injectable()
export class ZodBodyPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new ApiError(400, 'Validation failed', result.error.issues);
    return result.data;
  }
}
