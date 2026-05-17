import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getAdmissionFormRecord,
} from "@/queries/admission-form.queries";
import { redirect } from "next/navigation";
import ConfirmationAdmissionClient from "./ConfirmationAdmissionClient";
import { getAdmissionData } from "@/queries/admission.queries";
import DownloadPDF from "./AdmissionDownloadPDF";

interface AdmissionConfirmPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Admission Confirmation",
};

export default async function AdmissionConfirmPage({ params }: AdmissionConfirmPageProps) {
    const { id } = await params;
    const [schoolConfig, admissionSettings, admissionRecord] = await Promise.all([
        fetchSchoolConfig(),
        getAdmissionData(),
        getAdmissionFormRecord(id),
    ]);

    if (!admissionRecord) {
        redirect("/admission/form");
    }

    if (!admissionSettings.admission_open && admissionRecord.status !== "approved") {
        redirect("/");
    }
    if(admissionRecord.status === "approved") {
        return  <DownloadPDF
            admission={admissionRecord}
            schoolConfig={schoolConfig}
            pdf_url={`/api/admission/form/${id}/pdf`}
        />
    }
    return (
        <ConfirmationAdmissionClient
            admission={admissionRecord}
            schoolConfig={schoolConfig}
            pdf_url={`/api/admission/form/${id}/pdf`}
        />
    );
}
