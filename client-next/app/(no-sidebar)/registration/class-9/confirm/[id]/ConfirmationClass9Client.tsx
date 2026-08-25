'use client';

import { useState } from 'react';
import Link from '@/components/Link';
import axios from 'axios';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getFileUrl } from '@/lib/cdn';
import type { Class9RegistrationRecord } from '@school/shared-schemas';
import type { SchoolConfig } from '@/types';
import Class9DownloadPDF from './Class9DownloadPDF';

type ConfirmationClass9ClientProps = {
  registration: Class9RegistrationRecord;
  schoolConfig: SchoolConfig;
  pdfUrl: string;
};

export default function ConfirmationClass9Client({
  registration,
  schoolConfig,
  pdfUrl,
}: ConfirmationClass9ClientProps) {
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirmRegistration = async () => {
    if (!registration || registration.status === 'approved') return;

    try {
      setConfirming(true);
      const response = await axios.put(`/api/reg/class-9/form/${registration.id}/status`, {
        status: 'approved',
      });

      if (response.data.success) {
        toast.success('Registration confirmed successfully!');
        setIsConfirmed(true);
      } else {
        toast.error('Failed to confirm registration');
      }
    } catch {
      toast.error('Failed to confirm registration');
    } finally {
      setConfirming(false);
    }
  };

  const renderTableRow = (label: string, value: string | number | boolean | null | undefined) => (
    <tr className="border-b border-gray-100 align-top last:border-b-0">
      <td
        className="bg-gray-50 px-4 py-2 align-top font-medium text-gray-700"
        style={{ width: '38%', minWidth: '240px' }}
      >
        <div className="wrap-break-word whitespace-normal">{label}</div>
      </td>
      <td className="px-4 py-2 align-top" style={{ width: '62%' }}>
        <div className="wrap-break-word whitespace-normal">
          {value === null || value === undefined || value === '' ? (
            <span className="text-gray-400">Not provided</span>
          ) : typeof value === 'boolean' ? (
            value ? (
              'Yes'
            ) : (
              'No'
            )
          ) : (
            value.toString()
          )}
        </div>
      </td>
    </tr>
  );

  const joinAddr = (
    village?: string | null,
    postOffice?: string | null,
    postCode?: string | null,
    upazila?: string | null,
    district?: string | null,
  ) => {
    return (
      [
        village ?? '',
        postOffice ? (postCode ? `${postOffice} (${postCode})` : postOffice) : '',
        upazila ?? '',
        district ?? '',
      ]
        .filter(Boolean)
        .map((s) => s.toString().trim())
        .filter((s) => s.length > 0)
        .join(', ') || null
    );
  };

  const formatGuardianInfo = () => {
    if (
      !registration.guardian_name &&
      !registration.guardian_phone &&
      !registration.guardian_relation &&
      !registration.guardian_nid
    ) {
      return 'Not Applicable';
    }
    return (
      [
        registration.guardian_name ? `Name: ${registration.guardian_name}` : '',
        registration.guardian_relation ? `Relation: ${registration.guardian_relation}` : '',
        registration.guardian_phone ? `Phone: ${registration.guardian_phone}` : '',
        registration.guardian_nid ? `NID: ${registration.guardian_nid}` : '',
      ]
        .filter(Boolean)
        .join(', ') || 'Not Applicable'
    );
  };

  const formatGuardianAddress = () => {
    const address = joinAddr(
      registration.guardian_village_road,
      registration.guardian_post_office,
      registration.guardian_post_code,
      registration.guardian_upazila,
      registration.guardian_district,
    );
    return address || 'Not Applicable';
  };

  const formatDateLong = (dateStr?: string | null) => {
    if (!dateStr) return '';
    let d: string, m: string, y: string;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      [d, m, y] = dateStr.split('/');
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      [y, m, d] = dateStr.split('-');
    } else {
      return dateStr;
    }
    const dateObj = new Date(`${y}-${m}-${d}`);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj
      .toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      .replace(/(\w+)\s(\d{4})/, '$1, $2');
  };

  const formatMobileNumbers = () => {
    return (
      [registration.father_phone ?? '', registration.mother_phone ?? '']
        .filter(Boolean)
        .join(', ') || 'No'
    );
  };

  const formatJSCInfo = () => {
    return (
      [
        registration.jsc_board ? `Board: ${registration.jsc_board}` : '',
        registration.jsc_passing_year ? `Passing Year: ${registration.jsc_passing_year}` : '',
        registration.jsc_roll_no
          ? `JSC/JDC/Class 8 ID/Roll No- ${registration.jsc_roll_no}`
          : 'JSC/JDC/Class 8 ID/Roll No- N/A',
      ]
        .filter(Boolean)
        .join(', ') || null
    );
  };

  const formatScholarshipInfo = () => {
    const stipend =
      registration.upobritti === 'Yes' || registration.upobritti === 'No'
        ? `উপবৃত্তি: ${registration.upobritti === 'Yes' ? 'হ্যাঁ' : 'না'}`
        : '';
    const brirti = String(registration.sorkari_brirti ?? '').trim();
    const govScholarship = brirti
      ? `সরকারি বৃত্তি: ${
          brirti === 'No'
            ? 'না'
            : brirti === 'Talentpool'
              ? 'মেধাবৃত্তি'
              : brirti === 'General'
                ? 'সাধারণ বৃত্তি'
                : brirti === 'Yes'
                  ? 'হ্যাঁ'
                  : brirti
        }`
      : '';

    return [stipend, govScholarship].filter(Boolean).join(', ') || 'Not specified';
  };

  const formatMainAndFourthSubject = () => {
    return (
      [
        registration.group_class_nine ?? '',
        registration.main_subject ? `, ${registration.main_subject}` : '',
        registration.fourth_subject ? `, 4th: ${registration.fourth_subject}` : '',
      ]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ') || null
    );
  };

  const formatPreviousSchool = () => {
    return (
      [
        registration.prev_school_name,
        registration.prev_school_upazila,
        registration.prev_school_district,
      ]
        .filter(Boolean)
        .join(', ') || null
    );
  };

  const photoPath =
    registration.photo_path || (typeof registration.photo === 'string' ? registration.photo : null);

  if (isConfirmed) {
    return (
      <Class9DownloadPDF registration={registration} schoolConfig={schoolConfig} pdfUrl={pdfUrl} />
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-t bg-gray-800 p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">SSC Registration Confirmation</h1>
          <p className="mt-2 text-sm sm:text-base">
            Please review your information and confirm if everything is correct.
          </p>
        </div>

        {photoPath ? (
          <div className="flex flex-col items-center border-b border-gray-200 bg-white p-6">
            <h3 className="mb-2 text-base font-semibold text-gray-700">Student&apos;s Photo</h3>
            <Image
              src={getFileUrl(photoPath)}
              alt="Student Photo"
              width={112}
              height={142}
              className="aspect-[300/330] w-28 rounded border-2 border-gray-300 object-cover shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : null}

        <div className="space-y-8 bg-white p-4 sm:p-8">
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
            <span>Batch: {registration.ssc_batch || '-'}</span>
            <span>Section: {registration.section || '-'}</span>
            <span>Roll No: {registration.roll || '-'}</span>
            <span>Religion: {registration.religion || '-'}</span>
            <span>JSC/JDC/Class 8 Regi. No: {registration.jsc_reg_no || '-'}</span>
          </div>

          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table
              className="w-full table-auto text-sm md:table-fixed"
              style={{ minWidth: '600px' }}
            >
              <tbody>
                {renderTableRow(
                  'ছাত্রের নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
                  registration.student_name_bn,
                )}
                {renderTableRow("Student's Name:", registration.student_name_en?.toUpperCase())}
                {renderTableRow('Birth Registration Number:', registration.birth_reg_no)}
                {renderTableRow(
                  'Date of Birth (According to JSC/JDC/Class 8):',
                  formatDateLong(registration.birth_date),
                )}
                {renderTableRow('Email Address:', registration.email || 'No')}
                {renderTableRow('Mobile Numbers:', formatMobileNumbers())}
                {renderTableRow(
                  'পিতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
                  registration.father_name_bn,
                )}
                {renderTableRow("Father's Name:", registration.father_name_en?.toUpperCase())}
                {renderTableRow("Father's National ID Number:", registration.father_nid)}
                {renderTableRow(
                  'মাতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
                  registration.mother_name_bn,
                )}
                {renderTableRow("Mother's Name:", registration.mother_name_en?.toUpperCase())}
                {renderTableRow("Mother's National ID Number:", registration.mother_nid)}
                {renderTableRow(
                  'Permanent Address:',
                  joinAddr(
                    registration.permanent_village_road,
                    registration.permanent_post_office,
                    registration.permanent_post_code,
                    registration.permanent_upazila,
                    registration.permanent_district,
                  ),
                )}
                {renderTableRow(
                  'Present Address:',
                  joinAddr(
                    registration.present_village_road,
                    registration.present_post_office,
                    registration.present_post_code,
                    registration.present_upazila,
                    registration.present_district,
                  ),
                )}
                {renderTableRow("Guardian's Name:", formatGuardianInfo())}
                {renderTableRow("Guardian's Address:", formatGuardianAddress())}
                {renderTableRow('Previous School Name & Address:', formatPreviousSchool())}
                {renderTableRow('Information of JSC/JDC/Class 8:', formatJSCInfo())}
                {renderTableRow('Main and 4th Subject:', formatMainAndFourthSubject())}
                {renderTableRow('Scholarship Information:', formatScholarshipInfo())}
                {renderTableRow(
                  'বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
                  registration.nearby_nine_student_info,
                )}
                {renderTableRow('ছাত্রের ডাকনাম (বাংলায়):', registration.student_nick_name_bn)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-b border-t border-gray-200 bg-white p-6 text-center">
          <p className="mb-4 text-sm text-gray-600">
            Please review all information carefully before confirming your registration.
          </p>
          {registration.status !== 'approved' ? (
            <div className="mb-6">
              <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-4">
                <p className="mb-1 font-medium text-yellow-800">
                  Please review all information carefully before confirming
                </p>
                <p className="text-xs text-yellow-700">
                  Once confirmed, you cannot modify your registration details.
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href={`/registration/class-9/form/${registration.id}`}
                  className="flex cursor-pointer items-center justify-center rounded bg-gray-600 px-6 py-3 text-lg font-medium text-white! transition-all duration-200 hover:bg-gray-700 focus:outline-none"
                >
                  Edit registration
                </Link>
                <button
                  onClick={handleConfirmRegistration}
                  disabled={confirming}
                  className={`rounded px-8 py-3 font-medium transition-all duration-200 ${
                    confirming
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } flex items-center justify-center text-lg focus:outline-none`}
                >
                  {confirming ? 'Confirming...' : 'Confirm registration'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <div className="rounded border border-green-300 bg-green-50 p-4">
                <p className="font-medium text-green-800">Your registration has been confirmed</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
