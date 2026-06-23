import { redirect } from "next/navigation";
import { getClass6RegistrationSettings } from "@/queries/class6-registration.queries";
import RegistrationClass6Client from "./RegistrationClass6Client";

export const metadata = {
    title: "Class Six Registration Form",
};

export default async function Class6RegistrationFormPage() {
    const settings = await getClass6RegistrationSettings();

    if (!settings.reg_open) {
        redirect("/");
    }

    return <RegistrationClass6Client settings={settings} />;
}
