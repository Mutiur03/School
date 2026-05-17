import { redirect } from "next/navigation";
import AdmissionFormClient from "./AdmissionFormClient";
import { getAdmissionData } from "@/queries/admission.queries";

export const metadata = {
    title: "Admission Form",
};

export default async function AdmissionFormPage() {
    const [admissionSettings] = await Promise.all([
        getAdmissionData(),
    ]);

    if (!admissionSettings.admission_open) {
        redirect("/");
    }

    return (
        <AdmissionFormClient
            settings={admissionSettings}
        />
    );
}
