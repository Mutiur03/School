import { RolePlaceholder } from '@/features/roles/RolePlaceholder';
import { RoleGate } from '@/navigation/RoleGate';

export default function StudentHome() {
  return (
    <RoleGate role="student">
      <RolePlaceholder role="student" />
    </RoleGate>
  );
}
