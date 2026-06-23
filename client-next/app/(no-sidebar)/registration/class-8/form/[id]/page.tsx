import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
    getClass8RegistrationRecord,
    getClass8RegistrationSettings,
} from "@/queries/class8-registration.queries";
import RegistrationClass8Client from "../RegistrationClass8Client";

interface Class8RegistrationEditPageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Edit Class Eight Registration",
};

export default async function Class8RegistrationEditPage({
    params,
}: Class8RegistrationEditPageProps) {
    const { id } = await params;
    const [settings, record, schoolConfig] = await Promise.all([
        getClass8RegistrationSettings(),
        getClass8RegistrationRecord(id),
        fetchSchoolConfig(),
    ]);

    if (!record) {
        redirect("/registration/class-8/form");
    }

    if (record.status && record.status !== "pending") {
        redirect(`/registration/class-8/confirm/${id}`);
    }

    if (!settings.reg_open) {
        redirect("/");
    }

    return (
        <RegistrationClass8Client
            schoolConfig={schoolConfig}
            settings={settings}
            initialRecord={record}
        />
    );
}
