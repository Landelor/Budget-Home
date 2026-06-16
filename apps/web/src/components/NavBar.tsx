import { useState, useRef, useEffect } from "react";
import { useTheme } from "../hooks/useTheme.js";

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
  activePage: string;
}

export function NavBar({ onLogout, onNavigate, activePage }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const [expDropOpen, setExpDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setExpDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isExpensesGroup = activePage === "expenses" || activePage === "offset";

  function navBtn(page: string): React.CSSProperties {
    return page === activePage
      ? { ...styles.navBtn, ...styles.navBtnActive }
      : { ...styles.navBtn };
  }

  return (
    <header style={styles.header}>
      <h1 style={styles.heading}>BudgetApp</h1>
      <nav style={styles.nav}>
        <button style={navBtn("dashboard")} type="button" onClick={() => onNavigate("dashboard")}>
          Dashboard
        </button>

        {/* Expenses dropdown */}
        <div ref={dropRef} style={styles.dropWrapper}>
          <button
            style={isExpensesGroup ? { ...styles.navBtn, ...styles.navBtnActive } : styles.navBtn}
            type="button"
            onClick={() => setExpDropOpen((o) => !o)}
          >
            Expenses ▾
          </button>
          {expDropOpen && (
            <div style={styles.dropdown}>
              <button
                style={activePage === "expenses" ? { ...styles.dropItem, ...styles.dropItemActive } : styles.dropItem}
                type="button"
                onClick={() => { onNavigate("expenses"); setExpDropOpen(false); }}
              >
                Expenses
              </button>
              <button
                style={activePage === "offset" ? { ...styles.dropItem, ...styles.dropItemActive } : styles.dropItem}
                type="button"
                onClick={() => { onNavigate("offset"); setExpDropOpen(false); }}
              >
                Offset
              </button>
            </div>
          )}
        </div>

        <button style={navBtn("income")} type="button" onClick={() => onNavigate("income")}>
          Income
        </button>
        <button style={navBtn("utilities")} type="button" onClick={() => onNavigate("utilities")}>
          Utilities
        </button>
        <button style={navBtn("settings")} type="button" onClick={() => onNavigate("settings")}>
          Settings
        </button>
      </nav>
      <button onClick={toggleTheme} style={styles.themeBtn} type="button" title="Toggle dark mode">
        {isDark ? "Light mode" : "Dark mode"}
      </button>
      <button onClick={onLogout} style={styles.logoutBtn} type="button">
        Sign out
      </button>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    background: "#1a1a2e",
    color: "#fff",
    padding: "0.75rem 2rem",
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
  },
  heading: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: 700,
  },
  nav: {
    display: "flex",
    gap: "0.25rem",
    flex: 1,
    alignItems: "center",
  },
  navBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.65)",
    padding: "0.4rem 0.875rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  navBtnActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  },
  dropWrapper: {
    position: "relative",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    padding: "0.25rem",
    minWidth: "130px",
    zIndex: 200,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  },
  dropItem: {
    display: "block",
    width: "100%",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.75)",
    padding: "0.5rem 0.875rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    textAlign: "left",
  },
  dropItemActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  },
  themeBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "rgba(255,255,255,0.8)",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "0.4rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
};
