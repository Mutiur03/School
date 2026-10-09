import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateCertificateDto } from './create-certificate.dto.js';
import { FindCertificateDto } from './find-certificate.dto.js';
import { ListCertificateDto } from './list-certificate.dto.js';
import { UpdateCertificateDto } from './update-certificate.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (
  body: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: 'body' | 'query' = 'body',
) => pipe.transform(body, { type, metatype });

const valid = {
  exam: 'SSC',
  passing_year: 2020,
  student_name_bn: 'রহিম উদ্দিন',
  student_name_en: 'Md. Rahim Uddin',
  father_name_bn: 'করিম উদ্দিন',
  father_name_en: 'Md. Karim Uddin',
  mother_name_bn: 'রহিমা বেগম',
  mother_name_en: 'Mst. Rahima Begum',
  mobile: '01712345678',
  dob: '2005-03-14',
  roll: '123456',
  registration_no: '1234567890',
  gpa: '4.75',
};

describe('CreateCertificateDto', () => {
  it.each([
    [{}],
    [{ ...valid, mobile: '12345' }],
    [{ ...valid, student_name_bn: 'Rahim' }],
    [{ ...valid, student_name_en: 'রহিম' }],
    [{ ...valid, passing_year: 1970 }],
    [{ ...valid, passing_year: '2020' }],
    [{ ...valid, gender: 'Other' }],
    [{ ...valid, kind: 'board' }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateCertificateDto)).rejects.toMatchObject({ status: 400 });
  });

  it('accepts a full board body', async () => {
    await expect(run(valid, CreateCertificateDto)).resolves.toMatchObject(valid);
  });

  it('accepts a class body without roll/registration/GPA', async () => {
    const { roll, registration_no, gpa, ...rest } = valid;
    await expect(run({ ...rest, exam: '6' }, CreateCertificateDto)).resolves.toMatchObject({
      exam: '6',
    });
  });
});

describe('UpdateCertificateDto', () => {
  it('accepts a partial body', async () => {
    await expect(run({ mobile: '01812345678' }, UpdateCertificateDto)).resolves.toMatchObject({
      mobile: '01812345678',
    });
  });

  it('rejects unknown fields', async () => {
    await expect(run({ id: 'x' }, UpdateCertificateDto)).rejects.toMatchObject({ status: 400 });
  });
});

describe('ListCertificateDto', () => {
  it('accepts an empty query and a full one', async () => {
    await expect(run({}, ListCertificateDto, 'query')).resolves.toEqual({});
    const full = {
      page: '2',
      limit: '50',
      sort: 'edits',
      order: 'desc',
      name: 'rahim',
      mobile: '0171',
      exam: 'SSC,JSC',
      year: '2020,2021',
      edits: 'edited',
    };
    await expect(run(full, ListCertificateDto, 'query')).resolves.toMatchObject(full);
  });

  it.each([
    [{ sort: 'password' }],
    [{ order: 'up' }],
    [{ page: '-1' }],
    [{ limit: 'all' }],
    [{ year: '20,21' }],
    [{ exam: 'SSC;DROP' }],
    [{ edits: 'some' }],
    [{ school_id: '2' }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, ListCertificateDto, 'query')).rejects.toMatchObject({ status: 400 });
  });
});

describe('FindCertificateDto', () => {
  const query = { passing_year: '2020', mobile: '01712345678', dob: '2005-03-14' };

  it('accepts year + mobile + dob', async () => {
    await expect(run(query, FindCertificateDto, 'query')).resolves.toMatchObject(query);
  });

  it.each([
    [{ ...query, passing_year: '20' }],
    [{ ...query, mobile: '1' }],
    [{ ...query, dob: '14/03/2005' }],
    [{ mobile: query.mobile, dob: query.dob }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, FindCertificateDto, 'query')).rejects.toMatchObject({ status: 400 });
  });
});
