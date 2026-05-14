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
  sessionExpiresAt: string;
  message?: string;
};

type SessionResponse = {
  user: User;
  sessionExpiresAt: string;
};

type ServerOverview = {
  hostname: string;
  operatingSystem: string;
  kernel: string;
  platform: string;
  uptimeSeconds: number;
  currentTime: string;
  health: "Healthy" | "Warning" | "Critical";
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState("");
  const [serverOverview, setServerOverview] = useState<ServerOverview | null>(
    null,
  );
  const [serverOverviewLoading, setServerOverviewLoading] = useState(false);
  const [serverOverviewError, setServerOverviewError] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    void restoreSession(storedToken);
  }, []);

  async function restoreSession(storedToken: string) {
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (response.status === 401) {
        clearSession("Your session expired. Please sign in again.");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not restore session.");
      }

      const data = (await response.json()) as SessionResponse;
      setToken(storedToken);
      setUser(data.user);
      setSessionExpiresAt(data.sessionExpiresAt);

      if (data.user.role === "admin") {
        void loadServerOverview(storedToken);
      }
    } catch {
      clearSession("Could not restore your session. Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  function saveSession(
    nextToken: string,
    nextUser: User,
    nextSessionExpiresAt: string,
  ) {
    localStorage.setItem(tokenStorageKey, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setSessionExpiresAt(nextSessionExpiresAt);
    setServerOverview(null);
    setServerOverviewError("");
    setNotice("");
    setError("");

    if (nextUser.role === "admin") {
      void loadServerOverview(nextToken);
    }
  }

  function clearSession(message = "") {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
    setSessionExpiresAt("");
    setServerOverview(null);
    setServerOverviewError("");
    setNotice("");
    setError(message);
  }

  function clearMessages() {
    setNotice("");
    setError("");
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

    if (!response.ok || !data.token || !data.user || !data.sessionExpiresAt) {
      throw new Error(data.message || "Login failed.");
    }

    saveSession(data.token, data.user, data.sessionExpiresAt);
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

      if (response.status === 401) {
        clearSession("Your session expired. Please sign in again.");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not validate session.");
      }

      const data = (await response.json()) as SessionResponse;
      setUser(data.user);
      setSessionExpiresAt(data.sessionExpiresAt);
      setNotice("Session is active.");
    } catch {
      setError("Could not validate the current session.");
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

  async function loadServerOverview(sessionToken?: string) {
    const authToken = sessionToken || token;

    if (!authToken) {
      return;
    }

    setServerOverviewLoading(true);
    setServerOverviewError("");

    try {
      const response = await fetch(`${apiUrl}/api/server/overview`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 401) {
        clearSession("Your session expired. Please sign in again.");
        return;
      }

      if (response.status === 403) {
        setServerOverview(null);
        setServerOverviewError("Server overview requires an admin account.");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load server overview.");
      }

      const data = (await response.json()) as ServerOverview;
      setServerOverview(data);
    } catch (caughtError) {
      setServerOverview(null);
      setServerOverviewError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load server overview.",
      );
    } finally {
      setServerOverviewLoading(false);
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
    return (
      <LoginPage
        error={error}
        onClearMessages={clearMessages}
        onLogin={login}
      />
    );
  }

  return (
    <DashboardPage
      error={error}
      notice={notice}
      onCheckBackend={checkBackend}
      onCheckSession={checkSession}
      onLogout={logout}
      onRefreshServerOverview={loadServerOverview}
      sessionExpiresAt={sessionExpiresAt}
      serverOverview={serverOverview}
      serverOverviewError={serverOverviewError}
      serverOverviewLoading={serverOverviewLoading}
      user={user}
    />
  );
}

function LoginPage({
  error,
  onClearMessages,
  onLogin,
}: {
  error: string;
  onClearMessages: () => void;
  onLogin: (identifier: string, password: string) => Promise<void>;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const visibleError = loginError || error;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    onClearMessages();

    try {
      await onLogin(identifier.trim(), password);
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
        <p className="description">Use one of the local demo accounts.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email or username
            <input
              autoComplete="username"
              onChange={(event) => {
                setIdentifier(event.target.value);
                setLoginError("");
                onClearMessages();
              }}
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
              onChange={(event) => {
                setPassword(event.target.value);
                setLoginError("");
                onClearMessages();
              }}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
          </label>

          <button disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {visibleError && <p className="error">{visibleError}</p>}
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
  onRefreshServerOverview,
  sessionExpiresAt,
  serverOverview,
  serverOverviewError,
  serverOverviewLoading,
  user,
}: {
  error: string;
  notice: string;
  onCheckBackend: () => Promise<void>;
  onCheckSession: () => Promise<void>;
  onLogout: () => Promise<void>;
  onRefreshServerOverview: () => Promise<void>;
  sessionExpiresAt: string;
  serverOverview: ServerOverview | null;
  serverOverviewError: string;
  serverOverviewLoading: boolean;
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
          <dl className="detail-list">
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

        {user.role === "admin" && (
          <section className="panel">
            <div className="panel-heading">
              <h2>Server Overview</h2>
              <button
                className="secondary"
                disabled={serverOverviewLoading}
                onClick={() => {
                  void onRefreshServerOverview();
                }}
              >
                {serverOverviewLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {serverOverview ? (
              <dl className="detail-list">
                <div>
                  <dt>Health</dt>
                  <dd className={getHealthClass(serverOverview.health)}>
                    {serverOverview.health}
                  </dd>
                </div>
                <div>
                  <dt>Hostname</dt>
                  <dd>{serverOverview.hostname}</dd>
                </div>
                <div>
                  <dt>Operating system</dt>
                  <dd>{serverOverview.operatingSystem}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{serverOverview.platform}</dd>
                </div>
                <div>
                  <dt>Kernel</dt>
                  <dd>{serverOverview.kernel}</dd>
                </div>
                <div>
                  <dt>Uptime</dt>
                  <dd>{formatUptime(serverOverview.uptimeSeconds)}</dd>
                </div>
                <div>
                  <dt>Current time</dt>
                  <dd>{formatDateTime(serverOverview.currentTime)}</dd>
                </div>
              </dl>
            ) : (
              <p className="description">
                {serverOverviewLoading
                  ? "Loading server details..."
                  : "Server details are not loaded yet."}
              </p>
            )}

            {serverOverviewError && <p className="error">{serverOverviewError}</p>}
          </section>
        )}

        <section className="panel">
          <h2>Session</h2>
          <p className="description">
            This dashboard is visible while your session token is valid.
          </p>
          {sessionExpiresAt && (
            <p className="description">
              Session expires {formatDateTime(sessionExpiresAt)}.
            </p>
          )}

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

function formatUptime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    year: "numeric",
  }).format(date);
}

function getHealthClass(health: ServerOverview["health"]) {
  return `health-${health.toLowerCase()}`;
}

export default App;
