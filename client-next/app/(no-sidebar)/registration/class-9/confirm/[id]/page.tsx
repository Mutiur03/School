import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getClass9RegistrationRecord,
    getClass9RegistrationSettings,
} from "@/queries/class9-registration.queries";
import ConfirmationClass9Client from "./ConfirmationClass9Client";
import Class9DownloadPDF from "./Class9DownloadPDF";

interface Class9RegistrationConfirmPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "SSC Registration Confirmation",
};

export default async function Class9RegistrationConfirmPage({
    params,
}: Class9RegistrationConfirmPageProps) {
    const { id } = await params;
    const [schoolConfig, settings, registration] = await Promise.all([
        fetchSchoolConfig(),
        getClass9RegistrationSettings(),
        getClass9RegistrationRecord(id),
    ]);

    if (!registration) {
        redirect("/registration/class-9/form");
    }

    if (!settings.reg_open && registration.status !== "approved") {
        redirect("/");
    }

    const pdfUrl = `/api/reg/class-9/form/${id}/pdf`;

    if (registration.status === "approved") {
        return (
            <Class9DownloadPDF
                registration={registration}
                schoolConfig={schoolConfig}
                pdfUrl={pdfUrl}
            />
        );
    }

    return (
        <ConfirmationClass9Client
            registration={registration}
            schoolConfig={schoolConfig}
            pdfUrl={pdfUrl}
        />
    );
}
