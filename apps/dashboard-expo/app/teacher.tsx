import { RolePlaceholder } from '@/features/roles/RolePlaceholder';
import { RoleGate } from '@/navigation/RoleGate';

export default function TeacherHome() {
  return (
    <RoleGate role="teacher">
      <RolePlaceholder role="teacher" />
    </RoleGate>
  );
}
