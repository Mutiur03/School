/**
 * Password rules of the web teacher Security tab (TeacherSettings.tsx SecurityForm). The server
 * itself only enforces 8+ characters (TeacherService.changePassword); the extra rules are the
 * web page's client-side policy, kept here so both clients ask for the same thing.
 */
export interface PasswordRule {
  label: string;
  met: boolean;
}

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'At least one number', met: /[0-9]/.test(pw) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

const LABELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const BARS = ['bg-muted', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'] as const;

export function passwordStrength(pw: string) {
  const score = passwordRules(pw).filter((r) => r.met).length;
  return { score, label: LABELS[score]!, bar: BARS[score]! };
}

export interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** The web page's submit checks, in its order; null when the form can be sent. */
export function passwordFormError(f: PasswordForm): string | null {
  if (!f.currentPassword) return 'Enter your current password';
  if (passwordStrength(f.newPassword).score < 4)
    return 'Password does not meet all security requirements';
  if (f.newPassword !== f.confirmPassword) return 'New passwords do not match';
  return null;
}
