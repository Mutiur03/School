import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toPublicStaffProfile, toPublicTeacherProfile } from './publicPersonnelDto.util.js';

describe('public personnel DTO', () => {
  it('exposes email and phone but not address or secrets for teachers', () => {
    const row = {
      id: 1,
      name: 'Ada',
      designation: 'Math',
      email: 'ada@school.test',
      phone: '555-0100',
      address: '123 Secret St',
      password: 'hash',
      image: '1/teachers/a.jpg',
      available: true,
    };
    const pub = toPublicTeacherProfile(row);
    assert.equal(pub.email, 'ada@school.test');
    assert.equal(pub.phone, '555-0100');
    assert.equal(pub.name, 'Ada');
    assert.equal('address' in pub, false);
    assert.equal('password' in pub, false);
  });

  it('exposes email and phone but not address for staff', () => {
    const row = {
      id: 2,
      name: 'Bob',
      designation: 'Clerk',
      email: 'bob@school.test',
      phone: '555-0200',
      address: '456 Hidden Rd',
      image: null,
    };
    const pub = toPublicStaffProfile(row);
    assert.equal(pub.email, 'bob@school.test');
    assert.equal(pub.phone, '555-0200');
    assert.equal('address' in pub, false);
  });
});
