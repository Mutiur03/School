import { CODE_ALPHABET, generateSchoolCode, normalizeSchoolCode } from './school-code.util.js';

describe('generateSchoolCode', () => {
  it('ABC-7K4Q shape from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSchoolCode();
      expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{4}$/);
      for (const ch of code.replace('-', '')) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it('has no look-alike characters', () => {
    for (const ch of '01OIL') expect(CODE_ALPHABET).not.toContain(ch);
  });

  it('uses the injected CSPRNG', () => {
    expect(generateSchoolCode(() => 0)).toBe('AAA-AAAA');
  });
});

describe('normalizeSchoolCode', () => {
  it.each([
    ['ABC-7K4Q', 'ABC-7K4Q'],
    ['abc-7k4q', 'ABC-7K4Q'],
    [' abc 7k4q ', 'ABC-7K4Q'],
    ['ABC7K4Q', 'ABC-7K4Q'],
  ])('%j → %s', (input, expected) => expect(normalizeSchoolCode(input)).toBe(expected));

  it.each([[''], ['ABC-7K4'], ['ABC-7K4QQ'], ['AB0-7K4Q'], ['ABC-7K4%'], ["' OR 1=1"]])(
    '%j → null',
    (input) => expect(normalizeSchoolCode(input)).toBeNull(),
  );
});
