import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';

const cards = [
  {
    title: 'School management',
    description: 'Create tenants and edit branding, domains, admins, and contact details.',
    href: '/super_admin/settings/school',
    icon: Building2,
    action: 'Manage schools',
  },
  {
    title: 'Exams',
    description: 'Maintain the global exam catalog and assign types to each school.',
    href: '/super_admin/settings/exams',
    icon: ClipboardList,
    action: 'Manage exams',
  },
] as const;

export default function SuperAdminDashboard() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Super Admin"
        description="Platform-wide settings for all school tenants."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ title, description, href, icon: Icon, action }) => (
          <SectionCard key={href} title={title} icon={<Icon size={20} />}>
            <p className="text-muted-foreground mb-4 text-sm">{description}</p>
            <Button asChild className="w-full sm:w-auto">
              <Link to={href}>
                {action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
