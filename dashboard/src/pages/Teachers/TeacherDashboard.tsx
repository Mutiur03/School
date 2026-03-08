
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/useAuth";
import { getFileUrl } from "@/lib/backend";
import { getInitials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function TeacherProfile() {
    const { user } = useAuth();
    
    const { data: teacherProfile, isLoading } = useQuery({
        queryKey: ["teacher-profile"],
        queryFn: async () => {
            if (!user?.id) return null;
            const response = await axios.get("/api/teachers/me");
            return response.data.data;
        },
        enabled: !!user?.id,
    });

    const profile = teacherProfile || user;

    if (isLoading) {
        return (
            <div className="p-6 max-w-4xl mx-auto flex justify-center items-center">
                <div className="text-gray-600">Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {profile && profile.role === "teacher" && (
                <Card className="flex flex-col md:flex-row gap-6 shadow-xl rounded-2xl p-6 border border-gray-200 transition-shadow duration-300 hover:shadow-2xl">
                    <div className="h-56 w-56 rounded-full border-4 border-gray-300 shadow-sm overflow-hidden">
                        {profile?.image ? (
                            <img
                                src={getFileUrl(profile.image)}
                                alt="Profile"
                                className="w-full h-full object-cover object-top"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-600">
                                {getInitials(profile?.name)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 space-y-4">
                        <h2 className="text-3xl font-bold">{profile?.name}</h2>
                        <div className="text-sm space-y-1 mt-1">
                            <p><span className="font-medium">Email:</span> {profile?.email}</p>
                            <p><span className="font-medium">Phone:</span> {profile?.phone}</p>
                            <p><span className="font-medium">Designation:</span> {profile?.designation}</p>
                        </div>
                        <div className="mt-4">
                            <span className="font-semibold">Address:</span> {profile?.address || "Not specified"}
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
