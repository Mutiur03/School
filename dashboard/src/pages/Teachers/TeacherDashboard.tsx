
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/useAuth";
import backend from "@/lib/backend";
import { getInitials } from "@/lib/utils";
export default function TeacherProfile() {
    const { user } = useAuth();
    return (
        <div className="p-6 max-w-4xl mx-auto">
            {user && user.role === "teacher" && (
                <Card className="flex flex-col md:flex-row gap-6 shadow-xl rounded-2xl p-6 border border-gray-200 transition-shadow duration-300 hover:shadow-2xl">
                    <div className="h-56 w-56 rounded-full border-4 border-gray-300 shadow-sm overflow-hidden">
                        {user?.image ? (
                            <img
                                src={`${backend}/${user.image}`}
                                alt="Profile"
                                className="w-full h-full object-cover object-top"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-600">
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
                            <span className="font-semibold">Address:</span> {user?.address}
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
