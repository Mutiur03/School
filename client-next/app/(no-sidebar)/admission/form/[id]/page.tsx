import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getAdmissionFormRecord,
} from "@/queries/admission-form.queries";
import { redirect } from "next/navigation";
import AdmissionFormClient from "../AdmissionFormClient";
import { getAdmissionData } from "@/queries/admission.queries";

interface AdmissionFormEditPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Edit Admission Form",
};

export default async function AdmissionFormEditPage({ params }: AdmissionFormEditPageProps) {
    const { id } = await params;
    const [admissionSettings, admissionRecord] = await Promise.all([
        getAdmissionData(),
        getAdmissionFormRecord(id),
    ]);

    if (!admissionRecord) {
        redirect("/admission/form");
    }

    if (admissionRecord.status !== "pending") {
        redirect(`/admission/form/confirm/${id}`);
    }

    return (
        <AdmissionFormClient
            id={id}
            settings={admissionSettings}
            initialAdmissionRecord={admissionRecord}
        />
    );
}
