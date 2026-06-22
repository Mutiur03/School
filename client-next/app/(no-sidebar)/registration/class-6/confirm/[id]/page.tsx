import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getClass6RegistrationRecord,
    getClass6RegistrationSettings,
} from "@/queries/class6-registration.queries";
import ConfirmationClass6Client from "./ConfirmationClass6Client";
import Class6DownloadPDF from "./Class6DownloadPDF";

interface Class6RegistrationConfirmPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Class Six Registration Confirmation",
};

export default async function Class6RegistrationConfirmPage({
    params,
}: Class6RegistrationConfirmPageProps) {
    const { id } = await params;
    const [schoolConfig, settings, registration] = await Promise.all([
        fetchSchoolConfig(),
        getClass6RegistrationSettings(),
        getClass6RegistrationRecord(id),
    ]);

    if (!registration) {
        redirect("/registration/class-6/form");
    }

    if (!settings.reg_open && registration.status !== "approved") {
        redirect("/");
    }

    const pdfUrl = `/api/reg/class-6/form/${id}/pdf`;

    if (registration.status === "approved") {
        return (
            <Class6DownloadPDF
                registration={registration}
                schoolConfig={schoolConfig}
                pdfUrl={pdfUrl}
            />
        );
    }

    return (
        <ConfirmationClass6Client
            registration={registration}
            schoolConfig={schoolConfig}
            pdfUrl={pdfUrl}
        />
    );
}
