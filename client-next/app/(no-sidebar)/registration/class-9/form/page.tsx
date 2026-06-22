import { redirect } from "next/navigation";
import { fetchSchoolConfig } from "@/queries/school.queries";
import { getClass9RegistrationSettings } from "@/queries/class9-registration.queries";
import RegistrationClass9Client from "./RegistrationClass9Client";

export const metadata = {
    title: "SSC Registration Form",
};

export default async function Class9RegistrationFormPage() {
    const [settings, schoolConfig] = await Promise.all([
        getClass9RegistrationSettings(),
        fetchSchoolConfig(),
    ]);

    if (!settings.reg_open) {
        redirect("/");
    }

    return <RegistrationClass9Client schoolConfig={schoolConfig} />;
}
