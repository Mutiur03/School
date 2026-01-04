import { useContext } from "react";
import UnifiedAuthContext from "./unifiedAuthContext";

export const useAuth = () => useContext(UnifiedAuthContext);