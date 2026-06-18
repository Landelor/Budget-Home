import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSettings, updateSettings } from "../api/settings.js";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
});

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function ThemeProvider({ children, isAuthenticated }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      applyTheme(false);
      setIsDark(false);
      return;
    }
    getSettings()
      .then((s) => {
        const dark = s.darkMode ?? false;
        applyTheme(dark);
        setIsDark(dark);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      updateSettings({ darkMode: next }).catch(() => {
        applyTheme(prev);
        setIsDark(prev);
      });
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
