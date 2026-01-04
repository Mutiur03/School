import { useTheme } from "@/context/useTheme";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";

function ThemeChange({ vars }: { vars: string }) {
  const { theme, setTheme } = useTheme();
  const themes = ["light", "dark", "system"];

  const handleThemeChange = () => {
    const newTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(newTheme);
  };
  return (
    <div className={`flex scale-80  bg-popover p-2 rounded-full m-2 ${vars}`}>
      <button onClick={handleThemeChange}>
        {theme === "dark" && (
          <h1>
            <Moon></Moon>
          </h1>
        )}
        {theme === "light" && (
          <h1>
            <Sun></Sun>
          </h1>
        )}
        {theme === "system" && (
          <h1>
            <MonitorSmartphone></MonitorSmartphone>
          </h1>
        )}
      </button>
    </div>
  );
}

export default ThemeChange;
