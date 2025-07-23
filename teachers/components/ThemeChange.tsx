"use client";
import React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

function ThemeChange() {
    // Use the useTheme hook from next-themes to manage theme state
    const { theme, setTheme, resolvedTheme } = useTheme();

    React.useEffect(() => {
        if (!theme) {
            setTheme("system");
        }
    }, [theme, setTheme]);

    let icon;
    if (resolvedTheme === "light") {
        icon = <Sun className="h-5 w-5" />; // Show Sun for light mode
    } else if (resolvedTheme === "dark") {
        icon = <Moon className="h-5 w-5" />; // Show Moon for dark mode
    } else {
        icon = <Monitor className="h-5 w-5" />;
    }

    // Cycle theme: system -> light -> dark -> system
    const handleCycleTheme = () => {
        if (theme === "system") {
            setTheme("light");
        } else if (theme === "light") {
            setTheme("dark");
        } else {
            setTheme("system");
        }
    };

    return (
        <div className="flex  absolute top-0 right-0 ">
            <button
                // variant="ghost"
                // size="icon"
                onClick={handleCycleTheme}
                aria-label="Toggle theme"
                className="bg-accent hover:bg-muted/50 p-2 rounded-full m-2"
            >
                {icon}
            </button>
        </div>
    );
}

export default ThemeChange;
