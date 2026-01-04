import { useContext } from "react";
import TeacherAuthContext from "./teacherAuthContext";

export const useTeacherAuth = () => {
    const context = useContext(TeacherAuthContext);
    if (!context) {
        throw new Error("useTeacherAuth must be used within TeacherAuthProvider");
    }
    return context;
};
