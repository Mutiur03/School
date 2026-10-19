/**
 * A school's admin accounts (SchoolManagement.tsx "Admins" tab): list, delete, add.
 * GET/POST/DELETE /api/auth/super_admin/schools/:schoolId/admins. Add and delete are confirmed and
 * single-flight; the server validates addAdminSchema again.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Plus, RefreshCw, Trash2, UserCog } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { PasswordInput as SharedPasswordInput } from '@/components/ui/PasswordInput';
import { LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { cn } from '@/lib/utils';
import { usePlatformApi } from '@/session/ApiProvider';
import { validateAdminForm, type FieldErrors } from './model';
import { platformSchemas } from './schemas';
import { usePlatformKey, type useConfirmGate } from './ui';

export function AdminsPanel({
  schoolId,
  schoolName,
  confirm,
}: {
  schoolId: number;
  schoolName: string;
  confirm: ReturnType<typeof useConfirmGate>;
}) {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const queryClient = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: key('admins', schoolId),
    queryFn: ({ signal }) => platform.listAdmins(schoolId, signal),
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const admins = q.data ?? [];
  const busy = confirm.gate.busy;
  const reload = () => queryClient.invalidateQueries({ queryKey: key('admins', schoolId) });

  const add = () => {
    const v = validateAdminForm({ username, password }, platformSchemas);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    const body = v.value;
    confirm.ask(
      {
        title: 'Add school admin?',
        message: `"${body.username}" will be able to sign in to ${schoolName} with full admin rights.`,
        confirmLabel: 'Add admin',
        tone: 'default',
      },
      async () => {
        try {
          await platform.addAdmin(schoolId, body);
          toast.success('Admin added successfully');
          setUsername('');
          setPassword('');
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to add admin'));
        }
      },
    );
  };

  const remove = (admin: { id: number; username: string }) =>
    confirm.ask(
      {
        title: 'Delete admin?',
        message: `Delete admin "${admin.username}" from ${schoolName}? They can no longer sign in.`,
        confirmLabel: 'Delete Admin',
        tone: 'destructive',
      },
      async () => {
        try {
          await platform.deleteAdmin(schoolId, admin.id);
          toast.success('Admin deleted');
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to delete admin'));
        }
      },
    );

  return (
    <View className="gap-4" testID="platform-admins">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Icon icon={UserCog} size={16} color="primary" />
          <Text size="sm" weight="semibold">
            School Admins ({admins.length})
          </Text>
        </View>
        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          label="Refresh"
          disabled={q.isFetching}
          onPress={() => void q.refetch()}
        />
      </View>
      {q.isLoading ? (
        <LoadingState label="Loading admins…" />
      ) : admins.length === 0 ? (
        <Text size="sm" color="mutedForeground">
          {q.isError ? 'Failed to load school admins.' : 'No admins for this school yet.'}
        </Text>
      ) : (
        <View className="border-border rounded-lg border">
          {admins.map((a, i) => (
            <View
              key={a.id}
              className={cn(
                'flex-row items-center justify-between gap-3 px-4 py-3',
                i > 0 && 'border-border border-t',
              )}
            >
              <View className="min-w-0 flex-1">
                <Text weight="medium" numberOfLines={1}>
                  {a.username}
                </Text>
                <Text size="xs" color="mutedForeground" className="capitalize">
                  {a.role}
                </Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                icon={Trash2}
                label="Delete"
                disabled={busy}
                onPress={() => remove(a)}
              />
            </View>
          ))}
        </View>
      )}
      <View className="border-border gap-3 border-t pt-4">
        <FieldRow cols={3}>
          <Field label="Username" error={errors.username}>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. admin@school…"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              accessibilityLabel="Username"
            />
          </Field>
          <Field label="Password" error={errors.password}>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              show={show}
              onToggle={() => setShow((v) => !v)}
              placeholder="Min 6 characters…"
            />
          </Field>
          <View className="justify-end pt-6">
            <Button
              icon={Plus}
              label={busy ? 'Working…' : 'Add Admin'}
              disabled={busy || q.isLoading}
              onPress={add}
            />
          </View>
        </FieldRow>
      </View>
    </View>
  );
}

export function PasswordInput({
  value,
  onChangeText,
  show,
  onToggle,
  placeholder,
  label = 'Password',
}: {
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <SharedPasswordInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      shown={show}
      onToggleShown={onToggle}
      placeholder={placeholder}
      kind="new-password"
    />
  );
}
