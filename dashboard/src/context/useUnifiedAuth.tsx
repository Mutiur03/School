import { useContext } from "react";
import UnifiedAuthContext from "./unifiedAuthContext";

export const useUnifiedAuth = () => {
    const context = useContext(UnifiedAuthContext);
    if (!context) {
        throw new Error("useUnifiedAuth must be used within UnifiedAuthProvider");
    }
    return context;
};
