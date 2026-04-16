import { Link } from "react-router-dom";

export default function SuperAdminDashboard() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage multi-tenant school configuration from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">School Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create schools and update branding, domain, and contact information.
          </p>
          <Link
            to="/super_admin/settings/school"
            className="inline-block mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Manage Schools
          </Link>
        </div>
      </div>
    </div>
  );
}
