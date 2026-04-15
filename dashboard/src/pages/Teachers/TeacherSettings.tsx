"use client";
import { useState, useContext, useRef } from "react";
import axios from "axios";
import UnifiedAuthContext from "@/context/unifiedAuthContext";
import type { TeacherUser } from "@/context/unifiedAuthContext";
import { PageHeader, TabNav, SectionCard } from "@/components";
import type { TabItem } from "@/components";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { getFileUrl } from "@/lib/backend";

export default function TeacherSettings() {
    const { user, checkAuth } = useContext(UnifiedAuthContext);
    const teacher = user as TeacherUser;
    const [activeTab, setActiveTab] = useState("profile");
    const [uploading, setUploading] = useState(false);
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const tabs: TabItem[] = [
        { id: "profile", label: "Profile", icon: <User size={16} /> },
        { id: "security", label: "Security", icon: <Lock size={16} /> },
    ];

    if (!user || user.role !== "teacher") {
        return <div className="p-8 text-center text-muted-foreground">Unauthorized access. Please log in as a teacher.</div>;
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size should be less than 2MB");
            return;
        }

        setUploading(true);
        try {
            const extension = file.name.split(".").pop();
            const key = `${teacher.id}-${Date.now()}.${extension}`;
            
            const { data: urlData } = await axios.post("/api/teachers/image/upload-url", {
                id: teacher.id,
                key,
                contentType: file.type,
            });

            if (!urlData.success) throw new Error(urlData.message);

            // 2. Upload to R2/S3 (use a clean axios instance to avoid baseURL interference)
            await axios.put(urlData.data.uploadUrl, file, {
                headers: { "Content-Type": file.type },
            });

            const { data: saveData } = await axios.put(`/api/teachers/${teacher.id}/image`, {
                key: urlData.data.key,
            });

            if (saveData.success) {
                toast.success("Profile image updated successfully");
                await checkAuth(); 
            } else {
                throw new Error(saveData.message);
            }
        } catch (err: any) {
            console.error("Image upload error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file for your signature");
            return;
        }
        if (file.size > 1 * 1024 * 1024) {
            toast.error("Signature image should be less than 1MB");
            return;
        }

        setUploadingSignature(true);
        try {
            const extension = file.name.split(".").pop();
            const key = `${teacher.id}-signature-${Date.now()}.${extension}`;
            
            const { data: urlData } = await axios.post("/api/teachers/signature/upload-url", {
                id: teacher.id,
                key,
                contentType: file.type,
            });

            if (!urlData.success) throw new Error(urlData.message);

            await axios.put(urlData.data.uploadUrl, file, {
                headers: { "Content-Type": file.type },
            });

            const { data: saveData } = await axios.put(`/api/teachers/${teacher.id}/signature`, {
                key: urlData.data.key,
            });

            if (saveData.success) {
                toast.success("Digital signature updated successfully");
                await checkAuth(); 
            } else {
                throw new Error(saveData.message);
            }
        } catch (err: any) {
            console.error("Signature upload error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to upload signature");
        } finally {
            setUploadingSignature(false);
            if (signatureInputRef.current) signatureInputRef.current.value = "";
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <PageHeader
                title="Teacher Account Settings"
                description="Manage your professional profile and account security settings."
            />

            <TabNav
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                className="mb-8"
            />

            <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {activeTab === "profile" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Avatar Section */}
                        <div className="lg:col-span-1">
                            <SectionCard title="Profile Photo" icon={<Camera size={18} />}>
                                <div className="flex flex-col items-center py-6">
                                    <div className="relative group">
                                        <div className="w-48 h-48 rounded-2xl overflow-hidden border-4 border-background shadow-xl bg-muted flex items-center justify-center transition-all duration-300 group-hover:shadow-2xl">
                                            {teacher.image ? (
                                                <img 
                                                    src={getFileUrl(teacher.image)} 
                                                    alt={teacher.name} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <User size={96} className="text-muted-foreground/30" />
                                            )}
                                            {uploading && (
                                                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                                                    <Loader2 className="animate-spin text-primary h-12 w-12" />
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="absolute -bottom-3 -right-3 p-3 bg-primary text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50 ring-4 ring-background"
                                            title="Update Profile Picture"
                                        >
                                            <Camera size={20} />
                                        </button>
                                    </div>
                                    <div className="mt-8 text-center space-y-2">
                                        <h2 className="text-2xl font-bold text-foreground">{teacher.name}</h2>
                                        <p className="text-primary font-medium flex items-center justify-center gap-2">
                                            <Briefcase size={16} /> {teacher.designation || "Staff Member"}
                                        </p>
                                        <div className="flex justify-center gap-2 pt-2">
                                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] font-black tracking-wider uppercase">Active</span>
                                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-black tracking-wider uppercase">Teacher</span>
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>
                        </div>

                        {/* Basic Info Section */}
                        <div className="lg:col-span-2 space-y-8">
                            <SectionCard title="Professional Information" icon={<User size={18} />}>
                                <div className="grid md:grid-cols-2 gap-8 py-4">
                                    <ProfileField icon={<Mail size={16} />} label="Email Address" value={teacher.email} />
                                    <ProfileField icon={<Phone size={16} />} label="Phone Number" value={teacher.phone || "Not provided"} />
                                    <ProfileField icon={<Briefcase size={16} />} label="Current Designation" value={teacher.designation || "Not provided"} />
                                </div>
                                <div className="mt-6 p-6 rounded-2xl bg-muted/40 border border-border/50">
                                    <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground mb-3">
                                        <MapPin size={14} className="text-primary" /> Permanent Address on File
                                    </Label>
                                    <p className="text-muted-foreground leading-relaxed italic border-l-4 border-primary/20 pl-4 py-1">
                                        {teacher.address || "Contact administrative office to update registry address."}
                                    </p>
                                </div>
                                <div className="mt-8 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                                    <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                                        For institutional data integrity, modification of professional records is only permitted by administrative staff.
                                    </p>
                                </div>
                            </SectionCard>

                            <SectionCard title="Digital Signature" icon={<PenTool size={18} />}>
                                <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
                                    <div className="relative group shrink-0">
                                        <div className="w-40 h-24 rounded-xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center bg-muted/30 transition-all group-hover:bg-muted/50">
                                            {teacher.signature ? (
                                                <img 
                                                    src={getFileUrl(teacher.signature)} 
                                                    alt="Teacher Signature" 
                                                    className="max-w-full max-h-full object-contain p-2"
                                                />
                                            ) : (
                                                <PenTool size={32} className="text-muted-foreground/20" />
                                            )}
                                            {uploadingSignature && (
                                                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                                                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => signatureInputRef.current?.click()}
                                            disabled={uploadingSignature}
                                            className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                            title="Update Signature"
                                        >
                                            <PenTool size={14} />
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-foreground">Official Signature</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            This signature will be automatically embedded in student marksheets and official transcripts. Please ensure the image is clear and has a white or transparent background.
                                        </p>
                                        <div className="flex gap-4 pt-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 text-[10px] font-black uppercase tracking-wider"
                                                onClick={() => signatureInputRef.current?.click()}
                                                disabled={uploadingSignature}
                                            >
                                                Upload New
                                            </Button>
                                            {teacher.signature && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={async () => {
                                                        if (window.confirm("Are you sure you want to remove your digital signature?")) {
                                                            try {
                                                                const { data } = await axios.delete(`/api/teachers/${teacher.id}/signature`);
                                                                if (data.success) {
                                                                    toast.success("Signature removed");
                                                                    await checkAuth();
                                                                }
                                                            } catch (err) {
                                                                toast.error("Failed to remove signature");
                                                            }
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

                {activeTab === "security" && (
                    <div className="max-w-3xl mx-auto">
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

function ProfileField({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground/80 flex items-center gap-2">
                {icon} {label}
            </Label>
            <div className="relative">
                <Input 
                    value={value} 
                    readOnly 
                    className="bg-muted/30 border-border/50 rounded-xl h-11 font-medium shadow-sm cursor-not-allowed pr-10" 
                />
                <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
            </div>
        </div>
    );
}

function SecurityForm() {
    const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState({ current: false, new: false, confirm: false });

    const passwordRequirements = [
        { label: "At least 8 characters", met: form.newPassword.length >= 8 },
        { label: "At least one uppercase letter", met: /[A-Z]/.test(form.newPassword) },
        { label: "At least one number", met: /[0-9]/.test(form.newPassword) },
        { label: "At least one special character", met: /[^A-Za-z0-9]/.test(form.newPassword) },
    ];

    const strength = passwordRequirements.filter(r => r.met).length;
    const strengthColor = ["bg-muted", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][strength];
    const strengthLabel = ["Weak", "Weak", "Fair", "Good", "Strong"][strength];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (strength < 4) {
            toast.error("Password does not meet all security requirements");
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post("/api/teachers/change-password", {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });
            if (res.data?.success) {
                toast.success("Security credentials updated");
                setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const toggleView = (field: keyof typeof view) => {
        setView(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 py-4">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Security Key</Label>
                    <div className="relative">
                        <Input 
                            id="currentPassword" 
                            type={view.current ? "text" : "password"} 
                            value={form.currentPassword} 
                            onChange={(e) => setForm({...form, currentPassword: e.target.value})} 
                            required 
                            className="h-12 rounded-xl border-border/60 focus:ring-primary/20 transition-all font-mono"
                            placeholder="••••••••"
                        />
                        <button 
                            type="button" 
                            onClick={() => toggleView("current")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                        >
                            {view.current ? <XCircle size={16} /> : <ShieldCheck size={16} />}
                        </button>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                            <Input 
                                id="newPassword" 
                                type={view.new ? "text" : "password"} 
                                value={form.newPassword} 
                                onChange={(e) => setForm({...form, newPassword: e.target.value})} 
                                required 
                                className="h-12 rounded-xl border-border/60 focus:ring-primary/20 transition-all font-mono"
                                placeholder="Min. 8 chars"
                            />
                            <button 
                                type="button" 
                                onClick={() => toggleView("new")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                            >
                                {view.new ? <XCircle size={16} /> : <ShieldCheck size={16} />}
                            </button>
                        </div>
                        
                        {/* Strength Indicator */}
                        {form.newPassword && (
                            <div className="space-y-2 pt-1 px-1 animate-in fade-in slide-in-from-top-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Strength: {strengthLabel}</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`h-1 w-6 rounded-full transition-all duration-500 ${i <= strength ? strengthColor : 'bg-muted'}`} />
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
                                type={view.confirm ? "text" : "password"} 
                                value={form.confirmPassword} 
                                onChange={(e) => setForm({...form, confirmPassword: e.target.value})} 
                                required 
                                className={`h-12 rounded-xl border-border/60 focus:ring-primary/20 transition-all font-mono ${form.confirmPassword && form.newPassword !== form.confirmPassword ? 'border-red-400 focus:ring-red-500/10' : ''}`}
                                placeholder="Match your password"
                            />
                            <button 
                                type="button" 
                                onClick={() => toggleView("confirm")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                            >
                                {view.confirm ? <XCircle size={16} /> : <ShieldCheck size={16} />}
                            </button>
                        </div>
                        {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                            <p className="text-[10px] font-bold text-red-500 px-1 animate-in fade-in slide-in-from-top-1">Passwords do not match</p>
                        )}
                        {form.confirmPassword && form.newPassword === form.confirmPassword && strength >= 4 && (
                            <p className="text-[10px] font-bold text-emerald-600 px-1 animate-in fade-in slide-in-from-top-1 flex items-center gap-1"><CheckCircle2 size={10} /> Configuration Valid</p>
                        )}
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {passwordRequirements.map((req, idx) => (
                        <div key={idx} className={`flex items-center gap-2 text-[10px] font-medium transition-colors ${req.met ? 'text-emerald-600' : 'text-muted-foreground/60'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${req.met ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`} />
                            {req.label}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-border gap-4">
                <div className="flex items-center gap-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 max-w-sm">
                    <ShieldCheck className="text-amber-500 shrink-0" size={16} />
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-tight">Updating your password will invalidate all other active sessions for your protection.</p>
                </div>
                <Button type="submit" disabled={loading || strength < 4 || form.newPassword !== form.confirmPassword} className="w-full sm:w-auto px-10 rounded-xl h-12 shadow-lg shadow-primary/20 font-black tracking-tight">
                    {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Lock size={18} className="mr-2" />}
                    SECURE IDENTITY
                </Button>
            </div>
        </form>
    );
}
