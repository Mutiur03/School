import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getClass9RegistrationRecord,
    getClass9RegistrationSettings,
} from "@/queries/class9-registration.queries";
import RegistrationClass9Client from "../RegistrationClass9Client";

interface Class9RegistrationEditPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Edit SSC Registration",
};

export default async function Class9RegistrationEditPage({
    params,
}: Class9RegistrationEditPageProps) {
    const { id } = await params;
    const [settings, record, schoolConfig] = await Promise.all([
        getClass9RegistrationSettings(),
        getClass9RegistrationRecord(id),
        fetchSchoolConfig(),
    ]);

    if (!record) {
        redirect("/registration/class-9/form");
    }

    if (record.status && record.status !== "pending") {
        redirect(`/registration/class-9/confirm/${id}`);
    }

    if (!settings.reg_open) {
        redirect("/");
    }

    return <RegistrationClass9Client schoolConfig={schoolConfig} />;
}
