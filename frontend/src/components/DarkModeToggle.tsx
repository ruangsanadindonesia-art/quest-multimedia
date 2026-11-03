import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

function applyDarkMode(isDark: boolean) {
    if (isDark) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

export default function DarkModeToggle() {
    const [darkMode, setDarkMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Initialize dark mode immediately (before component mounts)
    useEffect(() => {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const savedMode = localStorage.getItem("darkMode");
        const initial = savedMode === null ? systemPrefersDark : savedMode === "true";
        setDarkMode(initial);
        applyDarkMode(initial);
        setMounted(true);

        // Add transition class after initial load to prevent flash
        const t = setTimeout(() => {
            document.documentElement.classList.add("transition-colors");
        }, 100);
        return () => clearTimeout(t);
    }, []);

    // Listen for system preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        function handleChange(e: MediaQueryListEvent) {
            if (localStorage.getItem("darkMode") === null) {
                setDarkMode(e.matches);
                applyDarkMode(e.matches);
            }
        }

        mediaQuery.addEventListener("change", handleChange);
        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, []);

    function toggleDarkMode() {
        setDarkMode((prev) => {
            const next = !prev;
            applyDarkMode(next);
            localStorage.setItem("darkMode", next.toString());
            return next;
        });
    }

    return (
        <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
            aria-label="Toggle dark mode"
        >
            {mounted ? (
                darkMode ? (
                    <Sun className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                ) : (
                    <Moon className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                )
            ) : (
                <div className="w-5 h-5"></div>
            )}
        </button>
    );
}
