'use client';
import { useState, useContext, useRef } from 'react';
import axios from 'axios';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import UnifiedAuthContext from '@/context/unifiedAuthContext';
import type { TeacherUser } from '@/context/unifiedAuthContext';
import { PageHeader, TabNav, SectionCard } from '@/components';
import type { TabItem } from '@/components';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  User,
  Lock,
  Camera,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  PenTool,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export default function TeacherSettings() {
  const { confirm, dialog } = useConfirmDialog();
  const { user, checkAuth } = useContext(UnifiedAuthContext);
  const teacher = user as TeacherUser;
  const [activeTab, setActiveTab] = useState('profile');
  const [uploading, setUploading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'security', label: 'Security', icon: <Lock size={16} /> },
  ];

  if (!user || user.role !== 'teacher') {
    return (
      <div className="text-muted-foreground p-8 text-center">
        Unauthorized access. Please log in as a teacher.
      </div>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const key = `${teacher.id}-${Date.now()}.${extension}`;

      const { data: urlData } = await axios.post('/api/teachers/image/upload-url', {
        id: teacher.id,
        key,
        contentType: file.type,
      });

      if (!urlData.success) throw new Error(urlData.message);

      // 2. Upload to R2/S3 (use a clean axios instance to avoid baseURL interference)
      await putFileToPresignedUrl(urlData.data.uploadUrl, file, file.type);

      const { data: saveData } = await axios.put(`/api/teachers/${teacher.id}/image`, {
        key: urlData.data.key,
      });

      if (saveData.success) {
        toast.success('Profile image updated successfully');
        await checkAuth();
      } else {
        throw new Error(saveData.message);
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file for your signature');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Signature image should be less than 1MB');
      return;
    }

    setUploadingSignature(true);
    try {
      const extension = file.name.split('.').pop();
      const key = `${teacher.id}-signature-${Date.now()}.${extension}`;

      const { data: urlData } = await axios.post('/api/teachers/signature/upload-url', {
        id: teacher.id,
        key,
        contentType: file.type,
      });

      if (!urlData.success) throw new Error(urlData.message);

      await putFileToPresignedUrl(urlData.data.uploadUrl, file, file.type);

      const { data: saveData } = await axios.put(`/api/teachers/${teacher.id}/signature`, {
        key: urlData.data.key,
      });

      if (saveData.success) {
        toast.success('Digital signature updated successfully');
        await checkAuth();
      } else {
        throw new Error(saveData.message);
      }
    } catch (err: any) {
      console.error('Signature upload error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to upload signature');
    } finally {
      setUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  return (
    <div className="animate-in fade-in mx-auto max-w-7xl p-4 duration-500 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Teacher Account Settings"
        description="Manage your professional profile and account security settings."
      />

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-8" />

      <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Avatar Section */}
            <div className="lg:col-span-1">
              <SectionCard title="Profile Photo" icon={<Camera size={18} />}>
                <div className="flex flex-col items-center py-6">
                  <div className="group relative">
                    <div className="border-background bg-muted flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border-4 shadow-xl transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 group-hover:shadow-2xl">
                      {teacher.image ? (
                        <img
                          src={getFileUrl(teacher.image)}
                          alt={teacher.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User size={96} className="text-muted-foreground/30" />
                      )}
                      {uploading && (
                        <div className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                          <Loader2 className="text-primary h-12 w-12 animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-primary ring-background absolute -right-3 -bottom-3 rounded-xl p-3 text-white shadow-lg ring-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:scale-110 active:scale-95 disabled:opacity-50"
                      title="Update Profile Picture"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                  <div className="mt-8 space-y-2 text-center">
                    <h2 className="text-foreground text-2xl font-bold">{teacher.name}</h2>
                    <p className="text-primary flex items-center justify-center gap-2 font-medium">
                      <Briefcase size={16} /> {teacher.designation || 'Staff Member'}
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black tracking-wider text-emerald-700 uppercase dark:bg-emerald-900/30 dark:text-emerald-300">
                        Active
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black tracking-wider text-blue-700 uppercase dark:bg-blue-900/30 dark:text-blue-300">
                        Teacher
                      </span>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Basic Info Section */}
            <div className="space-y-8 lg:col-span-2">
              <SectionCard title="Professional Information" icon={<User size={18} />}>
                <div className="grid gap-8 py-4 md:grid-cols-2">
                  <ProfileField
                    icon={<Mail size={16} />}
                    label="Email Address"
                    value={teacher.email}
                  />
                  <ProfileField
                    icon={<Phone size={16} />}
                    label="Phone Number"
                    value={teacher.phone || 'Not provided'}
                  />
                  <ProfileField
                    icon={<Briefcase size={16} />}
                    label="Current Designation"
                    value={teacher.designation || 'Not provided'}
                  />
                </div>
                <div className="bg-muted/40 border-border/50 mt-6 rounded-2xl border p-6">
                  <Label className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-bold uppercase">
                    <MapPin size={14} className="text-primary" /> Permanent Address on File
                  </Label>
                  <p className="text-muted-foreground border-primary/20 border-l-4 py-1 pl-4 leading-relaxed italic">
                    {teacher.address || 'Contact administrative office to update registry address.'}
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <ShieldCheck className="shrink-0 text-blue-600 dark:text-blue-400" size={20} />
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                    For institutional data integrity, modification of professional records is only
                    permitted by administrative staff.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Digital Signature" icon={<PenTool size={18} />}>
                <div className="flex flex-col items-center gap-8 py-4 sm:flex-row">
                  <div className="group relative shrink-0">
                    <div className="border-border bg-muted/30 group-hover:bg-muted/50 flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                      {teacher.signature ? (
                        <img
                          src={getFileUrl(teacher.signature)}
                          alt="Teacher Signature"
                          className="max-h-full max-w-full object-contain p-2"
                        />
                      ) : (
                        <PenTool size={32} className="text-muted-foreground/20" />
                      )}
                      {uploadingSignature && (
                        <div className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                          <Loader2 className="text-primary h-8 w-8 animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={uploadingSignature}
                      className="bg-primary absolute -right-2 -bottom-2 rounded-lg p-2 text-white shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:scale-105 active:scale-95 disabled:opacity-50"
                      title="Update Signature"
                    >
                      <PenTool size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-foreground font-bold">Official Signature</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      This signature will be automatically embedded in student marksheets and
                      official transcripts. Please ensure the image is clear and has a white or
                      transparent background.
                    </p>
                    <div className="flex gap-4 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] font-black tracking-wider uppercase"
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={uploadingSignature}
                      >
                        Upload New
                      </Button>
                      {teacher.signature && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[10px] font-black tracking-wider text-red-500 uppercase hover:bg-red-50 hover:text-red-600"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Remove signature?',
                              msg: 'Are you sure you want to remove your digital signature?',
                              confirmLabel: 'Remove',
                            });
                            if (!ok) return;
                            try {
                              const { data } = await axios.delete(
                                `/api/teachers/${teacher.id}/signature`,
                              );
                              if (data.success) {
                                toast.success('Signature removed');
                                await checkAuth();
                              }
                            } catch (err) {
                              toast.error('Failed to remove signature');
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="mx-auto max-w-3xl">
            <SectionCard title="Update Password" icon={<Lock size={18} />}>
              <SecurityForm />
            </SectionCard>
          </div>
        )}
      </main>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <input
        type="file"
        ref={signatureInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleSignatureUpload}
      />
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground/80 flex items-center gap-2 text-[10px] font-bold uppercase">
        {icon} {label}
      </Label>
      <div className="relative">
        <Input
          value={value}
          readOnly
          className="bg-muted/30 border-border/50 h-11 cursor-not-allowed rounded-xl pr-10 font-medium shadow-sm"
        />
        <Lock
          size={12}
          className="text-muted-foreground/30 absolute top-1/2 right-3 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

function SecurityForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState({ current: false, new: false, confirm: false });

  const passwordRequirements = [
    { label: 'At least 8 characters', met: form.newPassword.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(form.newPassword) },
    { label: 'At least one number', met: /[0-9]/.test(form.newPassword) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(form.newPassword) },
  ];

  const strength = passwordRequirements.filter((r) => r.met).length;
  const strengthColor = ['bg-muted', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'][
    strength
  ];
  const strengthLabel = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (strength < 4) {
      toast.error('Password does not meet all security requirements');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/teachers/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (res.data?.success) {
        toast.success('Security credentials updated');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleView = (field: keyof typeof view) => {
    setView((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 py-4">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Security Key</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={view.current ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
              className="border-border/60 focus:ring-primary/20 h-12 rounded-xl font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => toggleView('current')}
              className="hover:bg-muted text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 transition-colors"
            >
              {view.current ? <XCircle size={16} /> : <ShieldCheck size={16} />}
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={view.new ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                className="border-border/60 focus:ring-primary/20 h-12 rounded-xl font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                placeholder="Min. 8 chars"
              />
              <button
                type="button"
                onClick={() => toggleView('new')}
                className="hover:bg-muted text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 transition-colors"
              >
                {view.new ? <XCircle size={16} /> : <ShieldCheck size={16} />}
              </button>
            </div>

            {/* Strength Indicator */}
            {form.newPassword && (
              <div className="animate-in fade-in slide-in-from-top-1 space-y-2 px-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                    Strength: {strengthLabel}
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 w-6 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 ${i <= strength ? strengthColor : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={view.confirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                className={`border-border/60 focus:ring-primary/20 h-12 rounded-xl font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform] ${form.confirmPassword && form.newPassword !== form.confirmPassword ? 'border-red-400 focus:ring-red-500/10' : ''}`}
                placeholder="Match your password"
              />
              <button
                type="button"
                onClick={() => toggleView('confirm')}
                className="hover:bg-muted text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 transition-colors"
              >
                {view.confirm ? <XCircle size={16} /> : <ShieldCheck size={16} />}
              </button>
            </div>
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="animate-in fade-in slide-in-from-top-1 px-1 text-[10px] font-bold text-red-500">
                Passwords do not match
              </p>
            )}
            {form.confirmPassword && form.newPassword === form.confirmPassword && strength >= 4 && (
              <p className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1 px-1 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={10} /> Configuration Valid
              </p>
            )}
          </div>
        </div>

        <div className="bg-muted/30 border-border/40 grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border p-4 sm:grid-cols-2">
          {passwordRequirements.map((req, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 text-[10px] font-medium transition-colors ${req.met ? 'text-emerald-600' : 'text-muted-foreground/60'}`}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${req.met ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`}
              />
              {req.label}
            </div>
          ))}
        </div>
      </div>

      <div className="border-border flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
        <div className="flex max-w-sm items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
          <ShieldCheck className="shrink-0 text-amber-500" size={16} />
          <p className="text-[10px] leading-tight font-medium text-amber-700 dark:text-amber-400">
            Updating your password will invalidate all other active sessions for your protection.
          </p>
        </div>
        <Button
          type="submit"
          disabled={loading || strength < 4 || form.newPassword !== form.confirmPassword}
          className="shadow-primary/20 h-12 w-full rounded-xl px-10 font-black tracking-tight shadow-lg sm:w-auto"
        >
          {loading ? (
            <Loader2 size={18} className="mr-2 animate-spin" />
          ) : (
            <Lock size={18} className="mr-2" />
          )}
          SECURE IDENTITY
        </Button>
      </div>
    </form>
  );
}
