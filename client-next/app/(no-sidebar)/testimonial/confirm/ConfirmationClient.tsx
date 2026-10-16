'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';
import type { SchoolConfig } from '@/types';
import type { CertificateRecord } from '@/queries/certificate.queries';
import { districts, upazilas } from '@school/shared-schemas';

const EXAM_LABEL: Record<string, string> = {
  SSC: 'SSC',
  JSC: 'JSC',
  '6': 'Class 6',
  '7': 'Class 7',
  '8': 'Class 8',
};

const placeName = (districtId: string, upazilaId: string) => {
  const district = districts.find((d) => d.id === districtId)?.name ?? districtId;
  const upazila = upazilas.find((u) => u.id === upazilaId)?.name ?? upazilaId;
  return { district, upazila };
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default function ConfirmationClient({
  certificate,
  schoolConfig,
}: {
  certificate: CertificateRecord;
  schoolConfig: SchoolConfig;
}) {
  const { id, data } = certificate;
  const pdfUrl = `/api/certificates/${id}/pdf`;
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(certificate.status === 'approved');
  const { district, upazila } = placeName(data.address_district, data.address_upazila);

  async function confirm() {
    if (isConfirmed) return;
    setConfirming(true);
    try {
      await axios.patch(`/api/certificates/${id}/status`, { status: 'approved' });
      toast.success('Certificate confirmed');
      setIsConfirmed(true);
    } catch {
      toast.error('Failed to confirm certificate');
    } finally {
      setConfirming(false);
    }
  }

  if (isConfirmed) {
    return (
      <ConfirmDownloadPDF
        title1="Certificate Confirmed!"
        title2="Download Your Certificate"
        bannerText="Your certificate has been confirmed. You can no longer edit it."
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={`Certificate_${data.student_name_en.replace(/\s+/g, '_')}.pdf`}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-t-xl bg-slate-800 p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Review certificate</h1>
          <p className="mt-2 text-sm text-slate-300">
            Check every detail carefully. Once confirmed, you cannot modify this certificate.
          </p>
        </div>

        <dl className="space-y-0 bg-white p-5 sm:p-8">
          <Row label="Student (English)" value={data.student_name_en} />
          <Row label="Student (Bangla)" value={data.student_name_bn} />
          <Row label="Father (English)" value={data.father_name_en} />
          <Row label="Father (Bangla)" value={data.father_name_bn} />
          <Row label="Mother (English)" value={data.mother_name_en} />
          <Row label="Mother (Bangla)" value={data.mother_name_bn} />
          <Row label="Birth Reg. / NID No." value={data.birth_reg_no} />
          <Row label="Date of birth" value={data.dob} />
          {data.gender && <Row label="Gender" value={data.gender} />}
          <Row label="Exam / Class" value={EXAM_LABEL[data.exam] ?? data.exam} />
          <Row label="Passing year" value={data.passing_year} />
          {data.roll && <Row label="Roll" value={data.roll} />}
          {data.registration_no && <Row label="Registration no." value={data.registration_no} />}
          {data.gpa && <Row label="GPA" value={data.gpa} />}
          <Row label="District" value={district} />
          <Row label="Upazila/Thana" value={upazila} />
          <Row label="Post office" value={data.address_post_office} />
          <Row label="Post office (Bangla)" value={data.address_post_office_bn} />
          <Row label="Post code" value={data.address_post_code} />
          <Row label="Village/Road" value={data.address_village_road} />
          <Row label="Village/Road (Bangla)" value={data.address_village_road_bn} />
          <Row label="Mobile" value={data.mobile} />
        </dl>

        <div className="rounded-b-xl border-t border-slate-200 bg-white p-6">
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">Check every detail before you confirm</p>
            <p className="mt-1 text-xs text-amber-800">
              The certificate PDF can be downloaded only after you confirm. Once confirmed, edits
              are locked until an admin unlocks the form.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {/* `!` beats the global unlayered `a:hover` colour/opacity rule. */}
            <Link
              href={`/testimonial?id=${id}`}
              className="text-slate-800! hover:opacity-100! inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-medium transition hover:bg-slate-50"
            >
              Edit details
            </Link>
            <button
              type="button"
              onClick={confirm}
              disabled={confirming}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm certificate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
