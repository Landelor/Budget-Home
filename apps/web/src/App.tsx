import { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { ThemeProvider } from "./hooks/useTheme.js";
import { AuthPage } from "./pages/AuthPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { ExpensesPage } from "./pages/ExpensesPage.js";
import { OffsetPage } from "./pages/OffsetPage.js";
import { UtilitiesPage } from "./pages/UtilitiesPage.js";
import { IncomePage } from "./pages/IncomePage.js";
import { NetWorthPage } from "./pages/NetWorthPage.js";

type Page = "dashboard" | "expenses" | "offset" | "utilities" | "income" | "networth" | "settings";

export function App() {
  const { isAuthenticated, loading, error, login, register, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");

  if (!isAuthenticated) {
    return (
      <ThemeProvider isAuthenticated={false}>
        <AuthPage
          onLogin={login}
          onRegister={register}
          loading={loading}
          error={error}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider isAuthenticated={true}>
      {page === "expenses" && (
        <ExpensesPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "offset" && (
        <OffsetPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "utilities" && (
        <UtilitiesPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "income" && (
        <IncomePage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "networth" && (
        <NetWorthPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "dashboard" && (
        <DashboardPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
    </ThemeProvider>
  );
}
