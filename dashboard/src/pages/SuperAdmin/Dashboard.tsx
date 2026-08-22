import { Link } from 'react-router-dom';

export default function SuperAdminDashboard() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Manage multi-tenant school configuration from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-xl border p-5">
          <h2 className="font-semibold">School Management</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Create schools and update branding, domain, and contact information.
          </p>
          <Link
            to="/super_admin/settings/school"
            className="bg-primary text-primary-foreground mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Manage Schools
          </Link>
        </div>
      </div>
    </div>
  );
}
