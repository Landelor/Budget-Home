import { useAuth } from "./hooks/useAuth.js";
import { AuthPage } from "./pages/AuthPage.js";
import { AccountsPage } from "./pages/AccountsPage.js";

export function App() {
  const { isAuthenticated, loading, error, login, register, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <AuthPage
        onLogin={login}
        onRegister={register}
        loading={loading}
        error={error}
      />
    );
  }

  return <AccountsPage onLogout={logout} />;
}
