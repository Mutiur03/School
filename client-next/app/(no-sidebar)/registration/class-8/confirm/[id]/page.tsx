import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getClass8RegistrationRecord,
    getClass8RegistrationSettings,
} from "@/queries/class8-registration.queries";
import ConfirmationClass8Client from "./ConfirmationClass8Client";
import Class8DownloadPDF from "./Class8DownloadPDF";

interface Class8RegistrationConfirmPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Class Eight Registration Confirmation",
};

export default async function Class8RegistrationConfirmPage({
    params,
}: Class8RegistrationConfirmPageProps) {
    const { id } = await params;
    const [schoolConfig, settings, registration] = await Promise.all([
        fetchSchoolConfig(),
        getClass8RegistrationSettings(),
        getClass8RegistrationRecord(id),
    ]);

    if (!registration) {
        redirect("/registration/class-8/form");
    }

    if (!settings.reg_open && registration.status !== "approved") {
        redirect("/");
    }

    const pdfUrl = `/api/reg/class-8/form/${id}/pdf`;

    if (registration.status === "approved") {
        return (
            <Class8DownloadPDF
                registration={registration}
                schoolConfig={schoolConfig}
                pdfUrl={pdfUrl}
            />
        );
    }

    return (
        <ConfirmationClass8Client
            registration={registration}
            schoolConfig={schoolConfig}
            pdfUrl={pdfUrl}
        />
    );
}
