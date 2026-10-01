/** Fields exposed on the public school site (teachers / staff directory). */
export const toPublicTeacherProfile = (teacher: Record<string, unknown>) => ({
  id: teacher.id,
  name: teacher.name,
  designation: teacher.designation ?? null,
  email: teacher.email ?? null,
  phone: teacher.phone ?? null,
  image: teacher.image ?? null,
  available: teacher.available ?? true,
});

export const toPublicStaffProfile = (staff: Record<string, unknown>) => ({
  id: staff.id,
  name: staff.name,
  designation: staff.designation ?? null,
  email: staff.email ?? null,
  phone: staff.phone ?? null,
  image: staff.image ?? null,
});
