import { FormEvent, useEffect, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const tokenStorageKey = "simple-auth-token";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "viewer" | "operator" | "admin";
};

type AuthResponse = {
  token: string;
  user: User;
  message?: string;
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Session expired.");
        }

        const data = (await response.json()) as { user: User };
        setUser(data.user);
      })
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [token]);

  function saveSession(nextToken: string, nextUser: User) {
    localStorage.setItem(tokenStorageKey, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setNotice("");
    setError("");
  }

  function clearSession() {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
  }

  async function login(identifier: string, password: string) {
    setError("");
    setNotice("");

    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = (await response.json()) as Partial<AuthResponse>;

    if (!response.ok || !data.token || !data.user) {
      throw new Error(data.message || "Login failed.");
    }

    saveSession(data.token, data.user);
  }

  async function logout() {
    if (token) {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }

    clearSession();
  }

  async function checkSession() {
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Session expired.");
      }

      const data = (await response.json()) as { user: User };
      setUser(data.user);
      setNotice("Session is active.");
    } catch {
      clearSession();
      setError("Please sign in again.");
    }
  }

  async function checkBackend() {
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${apiUrl}/api/health`);

      if (!response.ok) {
        throw new Error("Backend returned an error.");
      }

      const data = (await response.json()) as { status: string };
      setNotice(`Backend health: ${data.status}`);
    } catch {
      setError("Could not connect to the backend.");
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <p className="eyebrow">ServerPulse</p>
          <h1>Checking session</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return <LoginPage error={error} onLogin={login} />;
  }

  return (
    <DashboardPage
      error={error}
      notice={notice}
      onCheckBackend={checkBackend}
      onCheckSession={checkSession}
      onLogout={logout}
      user={user}
    />
  );
}

function LoginPage({
  error,
  onLogin,
}: {
  error: string;
  onLogin: (identifier: string, password: string) => Promise<void>;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(error);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");

    try {
      await onLogin(identifier, password);
    } catch (caughtError) {
      setLoginError(
        caughtError instanceof Error ? caughtError.message : "Could not sign in.",
      );
    } finally {
      setSubmitting(false);
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

        <form className="login-form" onSubmit={handleSubmit}>
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

          <button disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {(loginError || error) && <p className="error">{loginError || error}</p>}
      </section>
    </main>
  );
}

function DashboardPage({
  error,
  notice,
  onCheckBackend,
  onCheckSession,
  onLogout,
  user,
}: {
  error: string;
  notice: string;
  onCheckBackend: () => Promise<void>;
  onCheckSession: () => Promise<void>;
  onLogout: () => Promise<void>;
  user: User;
}) {
  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">ServerPulse</p>
            <h1>Dashboard</h1>
          </div>

          <button className="secondary" onClick={onLogout}>
            Logout
          </button>
        </header>

        <section className="panel account-panel">
          <h2>Signed in as {user.name}</h2>
          <dl className="account-list">
            <div>
              <dt>Username</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Session</h2>
          <p className="description">
            This dashboard is visible while your session token is valid.
          </p>

          <div className="actions">
            <button onClick={onCheckSession}>Check session</button>
            <button className="secondary" onClick={onCheckBackend}>
              Check backend
            </button>
          </div>

          {notice && <p className="success">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      </section>
    </main>
  );
}

export default App;
