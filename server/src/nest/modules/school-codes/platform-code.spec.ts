import { isPlatformAccessCode, platformAccessCode } from './platform-code.js';

describe('platform access code', () => {
  const env = (v?: string) => ({ PLATFORM_ACCESS_CODE: v }) as NodeJS.ProcessEnv;

  it('unset, empty or malformed → off', () => {
    for (const v of [undefined, '', 'AB0-7K4Q', 'TOO-LONGG', 'ABC7K4']) {
      expect(platformAccessCode(env(v))).toBeNull();
      expect(isPlatformAccessCode('ABC-7K4Q', env(v))).toBe(false);
    }
  });

  it('is normalised like a school code', () => {
    expect(platformAccessCode(env(' pfm 7k4q '))).toBe('PFM-7K4Q');
    expect(isPlatformAccessCode('PFM-7K4Q', env('pfm7k4q'))).toBe(true);
  });

  it('matches only the exact code', () => {
    expect(isPlatformAccessCode('PFM-7K4R', env('PFM-7K4Q'))).toBe(false);
    expect(isPlatformAccessCode('PFM-7K4', env('PFM-7K4Q'))).toBe(false);
  });
});
