import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { getFileUrl } from '@/lib/backend';
import { getInitials } from '@/lib/utils';

export default function TeacherProfile() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      {user && user.role === 'teacher' && (
        <Card className="border-border flex flex-col items-center gap-6 rounded-2xl border p-4 shadow-xl transition-shadow duration-300 hover:shadow-2xl sm:p-6 md:flex-row md:items-start">
          <div className="border-border h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 shadow-sm sm:h-44 sm:w-44 md:h-56 md:w-56">
            {user?.image ? (
              <img
                src={getFileUrl(user.image)}
                alt="Profile"
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="text-muted-foreground flex h-full w-full items-center justify-center bg-gray-200 text-4xl font-bold">
                {getInitials(user?.name)}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-3xl font-bold">{user?.name}</h2>
            <div className="mt-1 space-y-1 text-sm">
              <p>
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {user?.phone}
              </p>
              <p>
                <span className="font-medium">Designation:</span> {user?.designation}
              </p>
            </div>
            <div className="mt-4">
              <span className="font-semibold">Address:</span> {user?.address || 'Not specified'}
            </div>
            {user?.signature && (
              <div className="border-border mt-6 border-t pt-6">
                <span className="text-muted-foreground mb-2 block text-xs font-bold uppercase">
                  Digital Signature
                </span>
                <div className="border-border bg-muted/30 flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed">
                  <img
                    src={getFileUrl(user.signature)}
                    alt="Teacher Signature"
                    className="max-h-full max-w-full object-contain p-2"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
