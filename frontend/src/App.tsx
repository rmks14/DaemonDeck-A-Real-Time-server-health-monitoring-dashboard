import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const tokenStorageKey = "simple-auth-token";

type ApiStatus = {
  status: string;
};

type Role = "viewer" | "operator" | "admin";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
};

type AuthResponse = {
  token: string;
  user: User;
};

type MeResponse = {
  user: User;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
  status: AuthStatus;
  token: string | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(tokenStorageKey),
  );
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(tokenStorageKey) ? "loading" : "unauthenticated",
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    const storedToken = localStorage.getItem(tokenStorageKey);

    if (!storedToken) {
      clearSession();
      return null;
    }

    setStatus("loading");

    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      if (!response.ok) {
        clearSession();
        return null;
      }

      const data = (await response.json()) as MeResponse;
      setToken(storedToken);
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier, password }),
    });

    const data = (await response.json()) as Partial<AuthResponse> & {
      message?: string;
    };

    if (!response.ok || !data.token || !data.user) {
      throw new Error(data.message || "Login failed.");
    }

    localStorage.setItem(tokenStorageKey, data.token);
    setToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const storedToken = localStorage.getItem(tokenStorageKey);

    if (storedToken) {
      try {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
      } catch {
        // Local logout should still succeed if the backend is unavailable.
      }
    }

    clearSession();
  }, [clearSession]);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const storedToken = localStorage.getItem(tokenStorageKey);
      const headers = new Headers(init.headers);

      if (storedToken) {
        headers.set("Authorization", `Bearer ${storedToken}`);
      }

      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers,
      });

      if (response.status === 401) {
        clearSession();
      }

      return response;
    },
    [clearSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authFetch,
      login,
      logout,
      refreshSession,
      status,
      token,
      user,
    }),
    [authFetch, login, logout, refreshSession, status, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="page">
        <section className="panel">
          <p className="eyebrow">ServerPulse</p>
          <h1>Checking session</h1>
          <p className="description">Validating your access token.</p>
        </section>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <main className="page">
        <section className="panel">
          <p className="eyebrow">ServerPulse</p>
          <h1>Checking session</h1>
        </section>
      </main>
    );
  }

  if (status === "authenticated") {
    return <Navigate replace to="/dashboard" />;
  }

  return children;
}

function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(identifier, password);
      const destination =
        (location.state as { from?: { pathname?: string } } | null)?.from
          ?.pathname || "/dashboard";

      navigate(destination, { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">ServerPulse</p>
        <h1>Sign in</h1>
        <p className="description">
          Use demo, viewer, or operator with password123.
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <label>
            Email or username
            <input
              autoComplete="username"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="demo"
              required
              type="text"
              value={identifier}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password123"
              required
              type="password"
              value={password}
            />
          </label>

          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { authFetch, logout, refreshSession, user } = useAuth();

  async function checkBackend() {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/health`);

      if (!response.ok) {
        throw new Error("Backend returned an error.");
      }

      const data = (await response.json()) as ApiStatus;
      setApiStatus(data);
    } catch {
      setApiStatus(null);
      setError("Could not connect to the backend.");
    }
  }

  async function validateSession() {
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/auth/me");

      if (!response.ok) {
        return;
      }

      await response.json();
      setMessage("Session is active.");
    } catch {
      setError("Could not validate the current session.");
    }
  }

  async function handleRefreshSession() {
    setError("");
    setMessage("");

    const refreshedUser = await refreshSession();

    if (refreshedUser) {
      setMessage("Session refreshed.");
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">ServerPulse</p>
            <h1>Dashboard</h1>
          </div>

          <button className="secondary" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="panel account-panel">
          <h2>Signed in as {user?.name}</h2>
          <dl className="account-list">
            <div>
              <dt>Username</dt>
              <dd>{user?.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Session</h2>
          <p className="description">
            Protected dashboard content is available only while the JWT is valid.
          </p>

          <div className="actions action-row">
            <button onClick={validateSession}>Validate session</button>
            <button className="secondary" onClick={handleRefreshSession}>
              Refresh session
            </button>
            <button className="secondary" onClick={checkBackend}>
              Check backend
            </button>
          </div>

          {apiStatus && (
            <p className="success">Backend health: {apiStatus.status}</p>
          )}

          {message && <p className="success">{message}</p>}

          {error && <p className="error">{error}</p>}
        </section>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/dashboard" />} path="/" />
      <Route
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
        path="/login"
      />
      <Route
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
        path="/dashboard"
      />
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
