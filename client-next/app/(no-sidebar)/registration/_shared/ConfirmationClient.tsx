'use client';

import { useState, type ReactNode } from 'react';
import Link from '@/components/Link';
import axios from 'axios';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getFileUrl } from '@/lib/cdn';
import type {
  Class6RegistrationRecord,
  Class8RegistrationRecord,
  JuniorScholarshipRegistrationRecord,
  Class9RegistrationRecord,
} from '@school/shared-schemas';
import type { SchoolConfig } from '@/types';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

type Cell = string | number | boolean | null | undefined;

function joinAddr(
  village?: string | null,
  postOffice?: string | null,
  postCode?: string | null,
  upazila?: string | null,
  district?: string | null,
) {
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
}

function formatDateLong(dateStr?: string | null) {
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
}

function renderTableRow(label: string, value: Cell, labelWidth = '35%', valueWidth = '65%') {
  return (
    <tr className="border-b border-gray-100 align-top last:border-b-0">
      <td
        className="bg-gray-50 px-4 py-2 align-top font-medium text-gray-700"
        style={{ width: labelWidth, minWidth: labelWidth === '38%' ? '240px' : '200px' }}
      >
        <div className="wrap-break-word whitespace-normal">{label}</div>
      </td>
      <td className="px-4 py-2 align-top" style={{ width: valueWidth }}>
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
}

function renderOptionalRow(label: string, value: Cell) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return renderTableRow(label, value);
}

function sectionHeader(title: string) {
  return (
    <tr className="border-b border-gray-200 bg-gray-100">
      <td colSpan={2} className="px-4 py-2 font-bold text-gray-700">
        {title}
      </td>
    </tr>
  );
}

function Class6Details({ registration }: { registration: Class6RegistrationRecord }) {
  const showGuardian = registration.guardian_name || registration.guardian_phone;
  const guardianAddress = joinAddr(
    registration.guardian_village_road ?? '',
    registration.guardian_post_office ?? '',
    registration.guardian_post_code ?? '',
    registration.guardian_upazila ?? '',
    registration.guardian_district ?? '',
  );

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
        {registration.class6_year ? <span>Year: {registration.class6_year}</span> : null}
        {registration.section ? <span>Section: {registration.section}</span> : null}
        {registration.roll ? <span>Roll: {registration.roll}</span> : null}
        {registration.religion ? <span>Religion: {registration.religion}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full table-auto text-sm md:table-fixed" style={{ minWidth: '600px' }}>
          <tbody>
            {sectionHeader('Personal Information')}
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

            {sectionHeader('Address Information')}
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

            {showGuardian ? (
              <>
                {sectionHeader('Guardian Information')}
                {renderOptionalRow("Guardian's Name:", registration.guardian_name)}
                {renderOptionalRow("Guardian's NID:", registration.guardian_nid)}
                {renderOptionalRow("Guardian's Mobile Number:", registration.guardian_phone)}
                {renderOptionalRow('Relationship with Guardian:', registration.guardian_relation)}
                {renderOptionalRow("Guardian's Address:", guardianAddress)}
              </>
            ) : null}

            {sectionHeader('Previous School Information (Class 5)')}
            {renderOptionalRow('Name of Previous School:', registration.prev_school_name)}
            {renderOptionalRow('Passing Year:', registration.prev_school_passing_year)}
            {renderOptionalRow('Section:', registration.section_in_prev_school)}
            {renderOptionalRow('Roll:', registration.roll_in_prev_school)}
            {renderOptionalRow('District:', registration.prev_school_district)}
            {renderOptionalRow('Upazila/Thana:', registration.prev_school_upazila)}

            {sectionHeader('Student Information Reference')}
            {renderOptionalRow(
              'বাসার নিকটবর্তী ষষ্ঠ শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
              registration.nearby_student_info,
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Class8Details({
  registration,
  year,
}: {
  registration: Class8RegistrationRecord;
  year?: number | null;
}) {
  const guardianAddress = joinAddr(
    registration.guardian_village_road ?? '',
    registration.guardian_post_office ?? '',
    registration.guardian_post_code ?? '',
    registration.guardian_upazila ?? '',
    registration.guardian_district ?? '',
  );

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
        {year ? <span>Year: {year}</span> : null}
        {registration.section ? <span>Section: {registration.section}</span> : null}
        {registration.roll ? <span>Roll: {registration.roll}</span> : null}
        {registration.religion ? <span>Religion: {registration.religion}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full table-auto text-sm md:table-fixed" style={{ minWidth: '600px' }}>
          <tbody>
            {sectionHeader('Personal Information')}
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

            {sectionHeader('Address Information')}
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

            {sectionHeader('Guardian Information')}
            {renderOptionalRow("Guardian's Name:", registration.guardian_name)}
            {renderOptionalRow('Relationship with Guardian:', registration.guardian_relation)}
            {renderOptionalRow("Guardian's Mobile Number:", registration.guardian_phone)}
            {renderOptionalRow("Guardian's Address:", guardianAddress)}

            {sectionHeader('Previous School Information (Class Six)')}
            {renderOptionalRow('Registration No:', registration.registration_no)}
            {renderOptionalRow('Class Six Academic Session:', registration.class6_academic_session)}
            {renderOptionalRow('Name of Previous School:', registration.prev_school_name)}

            {sectionHeader('Student Information Reference')}
            {renderOptionalRow(
              'বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
              registration.nearby_student_info,
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function JuniorScholarshipDetails({
  registration,
  year,
}: {
  registration: JuniorScholarshipRegistrationRecord;
  year?: number | null;
}) {
  const guardianAddress = joinAddr(
    registration.guardian_village_road ?? '',
    registration.guardian_post_office ?? '',
    registration.guardian_post_code ?? '',
    registration.guardian_upazila ?? '',
    registration.guardian_district ?? '',
  );

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
        {year ? <span>Year: {year}</span> : null}
        {registration.section ? <span>Section: {registration.section}</span> : null}
        {registration.roll ? <span>Roll: {registration.roll}</span> : null}
        {registration.religion ? <span>Religion: {registration.religion}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full table-auto text-sm md:table-fixed" style={{ minWidth: '600px' }}>
          <tbody>
            {sectionHeader('Personal Information')}
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

            {sectionHeader('Address Information')}
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

            {sectionHeader('Guardian Information')}
            {renderOptionalRow("Guardian's Name:", registration.guardian_name)}
            {renderOptionalRow('Relationship with Guardian:', registration.guardian_relation)}
            {renderOptionalRow("Guardian's Mobile Number:", registration.guardian_phone)}
            {renderOptionalRow("Guardian's Address:", guardianAddress)}

            {sectionHeader('Previous School Information (Class Six)')}
            {renderOptionalRow('Name of Previous School:', registration.prev_school_name)}
            {renderOptionalRow(
              'Previous School Address:',
              joinAddr(
                '',
                '',
                '',
                registration.prev_school_upazila,
                registration.prev_school_district,
              ),
            )}

            {sectionHeader('Class Six Information')}
            {renderOptionalRow('Class Six Passing Year:', registration.class6_passing_year)}
            {renderOptionalRow('Class Six Board:', registration.class6_board)}
            {renderOptionalRow('Class Six Registration Number:', registration.class6_reg_no)}
            {renderOptionalRow('Class Six ID/Roll Number:', registration.class6_roll_no)}

            {sectionHeader('Student Information Reference')}
            {renderOptionalRow(
              'বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
              registration.nearby_student_info,
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Class9Details({ registration }: { registration: Class9RegistrationRecord }) {
  const guardianInfo = (() => {
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
  })();

  const guardianAddress =
    joinAddr(
      registration.guardian_village_road,
      registration.guardian_post_office,
      registration.guardian_post_code,
      registration.guardian_upazila,
      registration.guardian_district,
    ) || 'Not Applicable';

  const mobileNumbers =
    [registration.father_phone ?? '', registration.mother_phone ?? ''].filter(Boolean).join(', ') ||
    'No';

  const jscInfo =
    [
      registration.jsc_board ? `Board: ${registration.jsc_board}` : '',
      registration.jsc_passing_year ? `Passing Year: ${registration.jsc_passing_year}` : '',
      registration.jsc_roll_no
        ? `JSC/JDC/Class 8 ID/Roll No- ${registration.jsc_roll_no}`
        : 'JSC/JDC/Class 8 ID/Roll No- N/A',
    ]
      .filter(Boolean)
      .join(', ') || null;

  const scholarshipInfo = (() => {
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
  })();

  const mainAndFourth =
    [
      registration.group_class_nine ?? '',
      registration.main_subject ? `, ${registration.main_subject}` : '',
      registration.fourth_subject ? `, 4th: ${registration.fourth_subject}` : '',
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ') || null;

  const previousSchool =
    [
      registration.prev_school_name,
      registration.prev_school_upazila,
      registration.prev_school_district,
    ]
      .filter(Boolean)
      .join(', ') || null;

  const row = (label: string, value: Cell) => renderTableRow(label, value, '38%', '62%');

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
        <span>Batch: {registration.ssc_batch || '-'}</span>
        <span>Section: {registration.section || '-'}</span>
        <span>Roll No: {registration.roll || '-'}</span>
        <span>Religion: {registration.religion || '-'}</span>
        <span>JSC/JDC/Class 8 Regi. No: {registration.jsc_reg_no || '-'}</span>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full table-auto text-sm md:table-fixed" style={{ minWidth: '600px' }}>
          <tbody>
            {row(
              'ছাত্রের নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
              registration.student_name_bn,
            )}
            {row("Student's Name:", registration.student_name_en?.toUpperCase())}
            {row('Birth Registration Number:', registration.birth_reg_no)}
            {row(
              'Date of Birth (According to JSC/JDC/Class 8):',
              formatDateLong(registration.birth_date),
            )}
            {row('Email Address:', registration.email || 'No')}
            {row('Mobile Numbers:', mobileNumbers)}
            {row('পিতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):', registration.father_name_bn)}
            {row("Father's Name:", registration.father_name_en?.toUpperCase())}
            {row("Father's National ID Number:", registration.father_nid)}
            {row('মাতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):', registration.mother_name_bn)}
            {row("Mother's Name:", registration.mother_name_en?.toUpperCase())}
            {row("Mother's National ID Number:", registration.mother_nid)}
            {row(
              'Permanent Address:',
              joinAddr(
                registration.permanent_village_road,
                registration.permanent_post_office,
                registration.permanent_post_code,
                registration.permanent_upazila,
                registration.permanent_district,
              ),
            )}
            {row(
              'Present Address:',
              joinAddr(
                registration.present_village_road,
                registration.present_post_office,
                registration.present_post_code,
                registration.present_upazila,
                registration.present_district,
              ),
            )}
            {row("Guardian's Name:", guardianInfo)}
            {row("Guardian's Address:", guardianAddress)}
            {row('Previous School Name & Address:', previousSchool)}
            {row('Information of JSC/JDC/Class 8:', jscInfo)}
            {row('Main and 4th Subject:', mainAndFourth)}
            {row('Scholarship Information:', scholarshipInfo)}
            {row(
              'বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
              registration.nearby_nine_student_info,
            )}
            {row('ছাত্রের ডাকনাম (বাংলায়):', registration.student_nick_name_bn)}
          </tbody>
        </table>
      </div>
    </>
  );
}

type ConfirmationKind = 'class-6' | 'class-8' | 'junior-scholarship' | 'class-9';

type ConfirmationClientProps =
  | {
      kind: 'class-6';
      registration: Class6RegistrationRecord;
      schoolConfig: SchoolConfig;
      pdfUrl: string;
    }
  | {
      kind: 'class-8';
      registration: Class8RegistrationRecord;
      schoolConfig: SchoolConfig;
      pdfUrl: string;
    }
  | {
      kind: 'junior-scholarship';
      registration: JuniorScholarshipRegistrationRecord;
      schoolConfig: SchoolConfig;
      pdfUrl: string;
    }
  | {
      kind: 'class-9';
      registration: Class9RegistrationRecord;
      schoolConfig: SchoolConfig;
      pdfUrl: string;
    };

const CONFIRM_META: Record<
  ConfirmationKind,
  {
    title: string;
    pdfTitle2?: string;
    downloadFilename: (name: string | null | undefined, roll?: string | number | null) => string;
  }
> = {
  'class-6': {
    title: 'Registration Confirmation',
    downloadFilename: (name) => `Class6_Reg_${name?.replace(/\s+/g, '_')}.pdf`,
  },
  'class-8': {
    title: 'Registration Confirmation (Class 8)',
    downloadFilename: (name) => `Class8_Reg_${name?.replace(/\s+/g, '_')}.pdf`,
  },
  'junior-scholarship': {
    title: 'Junior Scholarship Examination Confirmation',
    downloadFilename: (name) => `JuniorScholarship_${name?.replace(/\s+/g, '_')}.pdf`,
  },
  'class-9': {
    title: 'SSC Registration Confirmation',
    pdfTitle2: 'Download Your SSC Registration Form',
    downloadFilename: (name, roll) =>
      `Class_9_Registration_${name?.replace(/\s+/g, '_') || roll}.pdf`,
  },
};

function getPhoto(
  kind: ConfirmationKind,
  registration:
    | Class6RegistrationRecord
    | Class8RegistrationRecord
    | JuniorScholarshipRegistrationRecord
    | Class9RegistrationRecord,
): string | null {
  if (kind === 'class-9') {
    const r = registration as Class9RegistrationRecord;
    return r.photo_path || (typeof r.photo === 'string' ? r.photo : null);
  }
  const photo = (
    registration as
      Class6RegistrationRecord | Class8RegistrationRecord | JuniorScholarshipRegistrationRecord
  ).photo;
  return typeof photo === 'string' && photo ? photo : null;
}

export default function ConfirmationClient(props: ConfirmationClientProps) {
  const { kind, registration, schoolConfig, pdfUrl } = props;
  const meta = CONFIRM_META[kind];
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirmRegistration = async () => {
    if (!registration || registration.status === 'approved') return;

    try {
      setConfirming(true);
      const response = await axios.put(`/api/reg/${kind}/form/${registration.id}/status`, {
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

  const downloadFilename = meta.downloadFilename(
    registration.student_name_en,
    kind === 'class-9' ? (registration as Class9RegistrationRecord).roll : undefined,
  );

  if (isConfirmed) {
    return (
      <ConfirmDownloadPDF
        title2={meta.pdfTitle2}
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={downloadFilename}
      />
    );
  }

  const photoPath = getPhoto(kind, registration);
  let details: ReactNode;
  if (kind === 'class-6') {
    details = <Class6Details registration={props.registration} />;
  } else if (kind === 'class-8') {
    details = (
      <Class8Details registration={props.registration} year={props.registration.class8_year} />
    );
  } else if (kind === 'junior-scholarship') {
    details = (
      <JuniorScholarshipDetails
        registration={props.registration}
        year={props.registration.jse_year}
      />
    );
  } else {
    details = <Class9Details registration={props.registration} />;
  }

  return (
    <div className="min-h-screen w-full bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-t bg-gray-800 p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">{meta.title}</h1>
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

        <div className="space-y-8 bg-white p-4 sm:p-8">{details}</div>

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
                  href={`/registration/${kind}/form/${registration.id}`}
                  className="flex cursor-pointer items-center justify-center rounded bg-gray-600 px-6 py-3 text-lg font-medium text-white! transition-all duration-200 hover:bg-gray-700 focus:outline-none"
                >
                  Edit registration info
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
                  {confirming ? 'Confirming...' : 'Confirm registration info'}
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
