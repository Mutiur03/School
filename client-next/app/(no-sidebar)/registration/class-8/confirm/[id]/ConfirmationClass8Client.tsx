'use client';

import { useState } from 'react';
import Link from '@/components/Link';
import axios from 'axios';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getFileUrl } from '@/lib/cdn';
import type { Class8RegistrationRecord } from '@school/shared-schemas';
import type { SchoolConfig } from '@/types';
import Class8DownloadPDF from './Class8DownloadPDF';

type ConfirmationClass8ClientProps = {
  registration: Class8RegistrationRecord;
  schoolConfig: SchoolConfig;
  pdfUrl: string;
};

export default function ConfirmationClass8Client({
  registration,
  schoolConfig,
  pdfUrl,
}: ConfirmationClass8ClientProps) {
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirmRegistration = async () => {
    if (!registration || registration.status === 'approved') return;

    try {
      setConfirming(true);
      const response = await axios.put(`/api/reg/class-8/form/${registration.id}/status`, {
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
        style={{ width: '35%', minWidth: '200px' }}
      >
        <div className="wrap-break-word whitespace-normal">{label}</div>
      </td>
      <td className="px-4 py-2 align-top" style={{ width: '65%' }}>
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

  const renderOptionalRow = (
    label: string,
    value: string | number | boolean | null | undefined,
  ) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return renderTableRow(label, value);
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

  const formatGuardianAddress = () => {
    const address = joinAddr(
      registration.guardian_village_road ?? '',
      registration.guardian_post_office ?? '',
      registration.guardian_post_code ?? '',
      registration.guardian_upazila ?? '',
      registration.guardian_district ?? '',
    );
    return address || null;
  };

  if (isConfirmed) {
    return (
      <Class8DownloadPDF registration={registration} schoolConfig={schoolConfig} pdfUrl={pdfUrl} />
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-t bg-gray-800 p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Registration Confirmation (Class 8)</h1>
          <p className="mt-2 text-sm sm:text-base">
            Please review your information and confirm if everything is correct.
          </p>
        </div>

        {registration.photo && (
          <div className="flex flex-col items-center border-b border-gray-200 bg-white p-6">
            <h3 className="mb-2 text-base font-semibold text-gray-700">Student&apos;s Photo</h3>
            <Image
              src={getFileUrl(registration.photo)}
              alt="Student Photo"
              width={112}
              height={142}
              className="aspect-[300/330] w-28 rounded border-2 border-gray-300 object-cover shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="space-y-8 bg-white p-4 sm:p-8">
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
            {registration.class8_year ? <span>Year: {registration.class8_year}</span> : null}
            {registration.section ? <span>Section: {registration.section}</span> : null}
            {registration.roll ? <span>Roll: {registration.roll}</span> : null}
            {registration.religion ? <span>Religion: {registration.religion}</span> : null}
          </div>

          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table
              className="w-full table-auto text-sm md:table-fixed"
              style={{ minWidth: '600px' }}
            >
              <tbody>
                <tr className="border-b border-gray-200 bg-gray-100">
                  <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
                    Personal Information
                  </td>
                </tr>
                {renderOptionalRow('Section:', registration.section)}
                {renderOptionalRow('Roll:', registration.roll)}
                {renderOptionalRow('Religion:', registration.religion)}
                {renderOptionalRow('ছাত্রের নাম (বাংলায়):', registration.student_name_bn)}
                {renderOptionalRow(
                  "Student's Name (in English):",
                  registration.student_name_en?.toUpperCase(),
                )}
                {renderOptionalRow('Birth Registration No:', registration.birth_reg_no)}
                {renderOptionalRow('Date of Birth:', formatDateLong(registration.birth_date))}
                {renderOptionalRow('Email:', registration.email)}
                {renderOptionalRow('পিতার নাম (বাংলায়):', registration.father_name_bn)}
                {renderOptionalRow(
                  "Father's Name (in English):",
                  registration.father_name_en?.toUpperCase(),
                )}
                {renderOptionalRow("Father's NID:", registration.father_nid)}
                {renderOptionalRow("Father's Mobile Number:", registration.father_phone)}
                {renderOptionalRow('মাতার নাম (বাংলায়):', registration.mother_name_bn)}
                {renderOptionalRow(
                  "Mother's Name (in English):",
                  registration.mother_name_en?.toUpperCase(),
                )}
                {renderOptionalRow("Mother's NID:", registration.mother_nid)}
                {renderOptionalRow("Mother's Mobile Number:", registration.mother_phone)}

                <tr className="border-b border-gray-200 bg-gray-100">
                  <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
                    Address Information
                  </td>
                </tr>
                {renderOptionalRow(
                  'Permanent Address:',
                  joinAddr(
                    registration.permanent_village_road,
                    registration.permanent_post_office,
                    registration.permanent_post_code,
                    registration.permanent_upazila,
                    registration.permanent_district,
                  ),
                )}
                {renderOptionalRow(
                  'Present Address:',
                  joinAddr(
                    registration.present_village_road,
                    registration.present_post_office,
                    registration.present_post_code,
                    registration.present_upazila,
                    registration.present_district,
                  ),
                )}

                <tr className="border-b border-gray-200 bg-gray-100">
                  <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
                    Guardian Information
                  </td>
                </tr>
                {renderOptionalRow("Guardian's Name:", registration.guardian_name)}
                {renderOptionalRow('Relationship with Guardian:', registration.guardian_relation)}
                {renderOptionalRow("Guardian's Mobile Number:", registration.guardian_phone)}
                {renderOptionalRow("Guardian's Address:", formatGuardianAddress())}

                <tr className="border-b border-gray-200 bg-gray-100">
                  <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
                    Previous School Information (Class Six)
                  </td>
                </tr>
                {renderOptionalRow('Registration No:', registration.registration_no)}
                {renderOptionalRow(
                  'Class Six Academic Session:',
                  registration.class6_academic_session,
                )}
                {renderOptionalRow('Name of Previous School:', registration.prev_school_name)}

                <tr className="border-b border-gray-200 bg-gray-100">
                  <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
                    Student Information Reference
                  </td>
                </tr>
                {renderOptionalRow(
                  'বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
                  registration.nearby_student_info,
                )}
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
                  href={`/registration/class-8/form/${registration.id}`}
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
