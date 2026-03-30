
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/useAuth";
import { getFileUrl } from "@/lib/backend";
import { getInitials } from "@/lib/utils";

export default function TeacherProfile() {
    const { user } = useAuth();
    return (
        <div className="p-6 max-w-4xl mx-auto">
            {user && user.role === "teacher" && (
                <Card className="flex flex-col md:flex-row gap-6 shadow-xl rounded-2xl p-6 border border-border transition-shadow duration-300 hover:shadow-2xl">
                    <div className="h-56 w-56 rounded-full border-4 border-border shadow-sm overflow-hidden">
                        {user?.image ? (
                            <img
                                src={getFileUrl(user.image)}
                                alt="Profile"
                                className="w-full h-full object-cover object-top"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-muted-foreground">
                                {getInitials(user?.name)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 space-y-4">
                        <h2 className="text-3xl font-bold">{user?.name}</h2>
                        <div className="text-sm space-y-1 mt-1">
                            <p><span className="font-medium">Email:</span> {user?.email}</p>
                            <p><span className="font-medium">Phone:</span> {user?.phone}</p>
                            <p><span className="font-medium">Designation:</span> {user?.designation}</p>
                        </div>
                        <div className="mt-4">
                            <span className="font-semibold">Address:</span> {user?.address || "Not specified"}
                        </div>
                        {user?.signature && (
                            <div className="mt-6 pt-6 border-t border-border">
                                <span className="text-xs font-bold uppercase text-muted-foreground block mb-2">Digital Signature</span>
                                <div className="w-40 h-20 rounded-lg overflow-hidden border border-dashed border-border flex items-center justify-center bg-muted/30">
                                    <img 
                                        src={getFileUrl(user.signature)} 
                                        alt="Teacher Signature" 
                                        className="max-w-full max-h-full object-contain p-2"
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
