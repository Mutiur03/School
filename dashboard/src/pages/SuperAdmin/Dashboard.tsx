import { Link } from 'react-router-dom';
import { Building2, Settings } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';

export default function SuperAdminDashboard() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Super Admin Dashboard"
        description="Manage multi-tenant school configuration from one place."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="School Management" icon={<Building2 size={20} />}>
          <p className="text-muted-foreground mb-4 text-sm">
            Create schools and update branding, domain, and contact information.
          </p>
          <Button asChild>
            <Link to="/super_admin/settings/school">
              <Settings className="mr-2 h-4 w-4" />
              Manage Schools
            </Link>
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
