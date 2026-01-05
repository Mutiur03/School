import { useUnifiedAuth } from "@/context/useUnifiedAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function StudentDashboard() {
    const { user } = useUnifiedAuth();
    const student = user && user.role === "student" ? user : null;

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">Student Dashboard</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Welcome</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg font-medium">{student?.name}</p>
                            <p className="text-sm text-muted-foreground">
                                ID: {student?.login_id}
                            </p>
                            {student?.email && (
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Enrollment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {student?.enrollments && student.enrollments.length > 0 ? (
                                <ul className="space-y-2">
                                    {student.enrollments.map((enrollment: { id: number; class: number; section: string; year: number }) => (
                                        <li key={enrollment.id} className="text-sm">
                                            Class {enrollment.class} - Section {enrollment.section} (
                                            {enrollment.year})
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No enrollment data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full" variant="outline">
                                View Results
                            </Button>
                            <Button className="w-full" variant="outline">
                                View Attendance
                            </Button>
                            <Button className="w-full" variant="outline">
                                View Assignments
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">No upcoming events</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Announcements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">No recent announcements</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default StudentDashboard;
