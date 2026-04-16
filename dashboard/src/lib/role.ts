import type { UserRole } from "@/context/unifiedAuthContext";

const envPreferredRole = (() => {
  const role = import.meta.env.VITE_DEFAULT_ROLE?.toLowerCase().replace("-", "_");
  if (role === "admin" || role === "teacher" || role === "student" || role === "super_admin") {
    return role as UserRole;
  }
  return null;
})();

export default envPreferredRole;