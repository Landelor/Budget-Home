import { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { ThemeProvider } from "./hooks/useTheme.js";
import { AuthPage } from "./pages/AuthPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { AccountsPage } from "./pages/AccountsPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { ExpensesPage } from "./pages/ExpensesPage.js";

type Page = "dashboard" | "transactions" | "accounts" | "expenses" | "settings";

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
      {page === "accounts" && (
        <AccountsPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "transactions" && (
        <TransactionsPage
          onLogout={logout}
          onNavigate={(p) => setPage(p as Page)}
        />
      )}
      {page === "expenses" && (
        <ExpensesPage
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
