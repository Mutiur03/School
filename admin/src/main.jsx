import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AppContextProvider } from "./context/appContext.jsx";
import { AuthProvider } from "./context/authContext.jsx";
import { ThemeProvider } from "./components/theme-provider.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppContextProvider>
        <BrowserRouter>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </AppContextProvider>
    </AuthProvider>
  </StrictMode>
);
