import { useContext } from "react";
import StudentAuthContext from "./studentAuthContext";

export const useStudentAuth = () => {
    const context = useContext(StudentAuthContext);
    if (!context) {
        throw new Error("useStudentAuth must be used within StudentAuthProvider");
    }
    return context;
};
