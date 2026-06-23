import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import { getClass8RegistrationSettings } from "@/queries/class8-registration.queries";
import RegistrationClass8Client from "./RegistrationClass8Client";

export const metadata = {
    title: "Class Eight Registration Form",
};

export default async function Class8RegistrationFormPage() {
    const [settings, schoolConfig] = await Promise.all([
        getClass8RegistrationSettings(),
        fetchSchoolConfig(),
    ]);

    if (!settings.reg_open) {
        redirect("/");
    }

    return <RegistrationClass8Client schoolConfig={schoolConfig} settings={settings} />;
}
