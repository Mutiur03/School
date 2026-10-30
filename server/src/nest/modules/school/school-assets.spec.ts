import { jest } from '@jest/globals';

const getUploadUrl = jest.fn(
  async (key: string, type: string) => `https://r2.test/${key}?ct=${type}`,
);
jest.unstable_mockModule('@/config/r2.js', () => ({ getUploadUrl }));
const { schoolAssetUploadUrl, XLSX_TYPE } = await import('./school-assets.js');

describe('schoolAssetUploadUrl', () => {
  beforeEach(() => getUploadUrl.mockClear());

  it.each([
    ['logo', 'logos'],
    ['header', 'headers'],
    ['banner', 'banners'],
    ['hotline', 'hotlines'],
  ])('puts a %s under schools/%s/', async (kind, folder) => {
    const r = await schoolAssetUploadUrl('a.png', 'image/png', kind);
    expect(r.kind).toBe(kind);
    expect(r.key).toMatch(new RegExp(`^schools/${folder}/\\d{13}-a\\.png$`));
    expect(getUploadUrl).toHaveBeenCalledWith(r.key, 'image/png');
    expect(r.uploadUrl).toBe(`https://r2.test/${r.key}?ct=image/png`);
  });

  it('falls back to logo for a missing or unknown kind', async () => {
    expect((await schoolAssetUploadUrl('a.png', 'image/png')).kind).toBe('logo');
    expect((await schoolAssetUploadUrl('a.png', 'image/png', 'avatar')).key).toMatch(
      /^schools\/logos\//,
    );
  });

  it('sanitizes the base name, keeps the extension and defaults it to .png', async () => {
    expect((await schoolAssetUploadUrl('My Logo (1)!.webp', 'image/webp')).key).toMatch(
      /^schools\/logos\/\d+-My-Logo--1--\.webp$/,
    );
    expect((await schoolAssetUploadUrl('../../etc/passwd', 'image/png')).key).toMatch(
      /^schools\/logos\/\d+-passwd\.png$/,
    );
  });

  it('exports the xlsx content type', () => {
    expect(XLSX_TYPE).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
