import { useState, type FormEvent } from "react";

interface Props {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  loading: boolean;
  error: string | null;
}

export function AuthPage({ onLogin, onRegister, loading, error }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      onLogin(email, password);
    } else {
      onRegister(email, password);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>BudgetApp</h1>
        <p style={styles.sub}>Your home budgeting companion</p>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => setMode("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            style={{ ...styles.tab, ...(mode === "register" ? styles.tabActive : {}) }}
            onClick={() => setMode("register")}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              autoComplete="email"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-page)",
    padding: "1rem",
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "2.5rem 2rem",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    width: "100%",
    maxWidth: "400px",
  },
  heading: {
    margin: "0 0 0.25rem",
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  sub: {
    margin: "0 0 1.5rem",
    color: "var(--text-secondary)",
    fontSize: "0.9rem",
  },
  tabs: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
  },
  tab: {
    flex: 1,
    padding: "0.5rem",
    border: "2px solid var(--border)",
    borderRadius: "8px",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 500,
    color: "var(--text-secondary)",
    fontSize: "0.9rem",
    transition: "all 0.15s",
  },
  tabActive: {
    borderColor: "#4f46e5",
    background: "#4f46e5",
    color: "#fff",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text-label)",
  },
  input: {
    padding: "0.625rem 0.75rem",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    margin: 0,
    background: "#fef2f2",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
  button: {
    padding: "0.75rem",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "0.5rem",
  },
};
