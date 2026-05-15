import StaffList from "./StaffList";
import { fetchStaffs, type StaffMember } from "@/queries/staff.queries";

const normalizeStaff = (staff: StaffMember, index: number) => ({
    id: Number(staff.id) || index + 1,
    name: staff.name || staff.fullname || `Staff Member ${index + 1}`,
    designation: staff.designation || "Staff",
    image: staff.image,
    email: staff.email || staff.contact?.email,
    phone: staff.phone || staff.contact?.phone,
    address: staff.address || staff.homeTown || staff.location,
});

async function page() {
    const staffRaw = await fetchStaffs();
    const staff = staffRaw.map(normalizeStaff);

    return <StaffList staff={staff} />;
}

export default page;
