import { FormEvent, useEffect, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const tokenStorageKey = "simple-auth-token";

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

type Metrics = {
  cpuLoadAverage: number[];
  freeMemory: number;
  memoryUsedPercent: number;
  processUptimeSeconds: number;
  systemUptimeSeconds: number;
  totalMemory: number;
};

type LogEntry = {
  id: string;
  level: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
};

type ProcessRecord = {
  id: string;
  name: string;
  status: "running" | "restarting";
  lastRestartedAt: string | null;
};

type AlertRule = {
  id: string;
  name: string;
  condition: string;
  enabled: boolean;
};

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T | null>;

function App() {
  const [route, setRoute] = useState(() => window.location.pathname || "/");
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function handlePopState() {
      setRoute(window.location.pathname || "/");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    void restoreSession(storedToken);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && route !== "/login") {
      navigate("/login", true);
      return;
    }

    if (user && (route === "/" || route === "/login")) {
      navigate("/dashboard", true);
    }
  }, [loading, route, user]);

  function navigate(nextRoute: string, replace = false) {
    if (window.location.pathname !== nextRoute) {
      if (replace) {
        window.history.replaceState(null, "", nextRoute);
      } else {
        window.history.pushState(null, "", nextRoute);
      }
    }

    setRoute(nextRoute);
  }

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
    setNotice("");
    setError("");
    navigate("/dashboard", true);
  }

  function clearSession(message = "") {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
    setSessionExpiresAt("");
    setNotice("");
    setError(message);
  }

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function login(identifier: string, password: string) {
    clearMessages();

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
    navigate("/login", true);
  }

  async function apiRequest<T>(path: string, init: RequestInit = {}) {
    if (!token) {
      clearSession("Your session expired. Please sign in again.");
      navigate("/login", true);
      return null;
    }

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearSession("Your session expired. Please sign in again.");
      navigate("/login", true);
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data as T;
  }

  async function checkSession() {
    clearMessages();

    const data = await apiRequest<SessionResponse>("/api/auth/me");

    if (!data) {
      return;
    }

    setUser(data.user);
    setSessionExpiresAt(data.sessionExpiresAt);
    setNotice("Session is active.");
  }

  async function checkBackend() {
    clearMessages();

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
      apiRequest={apiRequest}
      error={error}
      navigate={navigate}
      notice={notice}
      onCheckBackend={checkBackend}
      onCheckSession={checkSession}
      onLogout={logout}
      route={route}
      sessionExpiresAt={sessionExpiresAt}
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
  apiRequest,
  error,
  navigate,
  notice,
  onCheckBackend,
  onCheckSession,
  onLogout,
  route,
  sessionExpiresAt,
  user,
}: {
  apiRequest: ApiRequest;
  error: string;
  navigate: (nextRoute: string) => void;
  notice: string;
  onCheckBackend: () => Promise<void>;
  onCheckSession: () => Promise<void>;
  onLogout: () => Promise<void>;
  route: string;
  sessionExpiresAt: string;
  user: User;
}) {
  const canOperate = user.role === "operator" || user.role === "admin";
  const canAdmin = user.role === "admin";
  const knownRoute =
    route === "/dashboard" ||
    route === "/dashboard/metrics" ||
    route === "/dashboard/logs" ||
    route === "/dashboard/operations" ||
    route === "/dashboard/admin";
  const tabs = [
    { label: "Overview", path: "/dashboard" },
    { label: "Metrics", path: "/dashboard/metrics" },
    { label: "Logs", path: "/dashboard/logs" },
    ...(canOperate ? [{ label: "Operations", path: "/dashboard/operations" }] : []),
    ...(canAdmin ? [{ label: "Admin", path: "/dashboard/admin" }] : []),
  ];

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

        <nav className="tabs" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button
              className={route === tab.path ? "tab active" : "tab"}
              key={tab.path}
              onClick={() => navigate(tab.path)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {route === "/dashboard" && (
          <OverviewPanel
            apiRequest={apiRequest}
            error={error}
            notice={notice}
            onCheckBackend={onCheckBackend}
            onCheckSession={onCheckSession}
            sessionExpiresAt={sessionExpiresAt}
            user={user}
          />
        )}
        {route === "/dashboard/metrics" && <MetricsPanel apiRequest={apiRequest} />}
        {route === "/dashboard/logs" && <LogsPanel apiRequest={apiRequest} />}
        {route === "/dashboard/operations" && canOperate && (
          <OperationsPanel apiRequest={apiRequest} />
        )}
        {route === "/dashboard/admin" && canAdmin && (
          <AdminPanel apiRequest={apiRequest} currentUser={user} />
        )}
        {((route === "/dashboard/operations" && !canOperate) ||
          (route === "/dashboard/admin" && !canAdmin)) && (
          <MessagePanel message="You do not have permission to view this section." />
        )}
        {!knownRoute && <MessagePanel message="Dashboard section was not found." />}
      </section>
    </main>
  );
}

function OverviewPanel({
  apiRequest,
  error,
  notice,
  onCheckBackend,
  onCheckSession,
  sessionExpiresAt,
  user,
}: {
  apiRequest: ApiRequest;
  error: string;
  notice: string;
  onCheckBackend: () => Promise<void>;
  onCheckSession: () => Promise<void>;
  sessionExpiresAt: string;
  user: User;
}) {
  return (
    <>
      <section className="panel account-panel">
        <h2>Signed in as {user.name}</h2>
        <dl className="detail-list">
          <Detail label="Username" value={user.username} />
          <Detail label="Email" value={user.email} />
          <Detail label="Role" value={user.role} />
        </dl>
      </section>

      {user.role === "admin" && <ServerOverviewPanel apiRequest={apiRequest} />}

      <section className="panel">
        <h2>Session</h2>
        <p className="description">
          This dashboard is visible while your JWT is valid.
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
    </>
  );
}

function ServerOverviewPanel({ apiRequest }: { apiRequest: ApiRequest }) {
  const [overview, setOverview] = useState<ServerOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<ServerOverview>("/api/server/overview");

      if (data) {
        setOverview(data);
      }
    } catch (caughtError) {
      setOverview(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load server overview.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Server Overview</h2>
        <button className="secondary" disabled={loading} onClick={loadOverview}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {overview ? (
        <dl className="detail-list">
          <Detail
            className={getHealthClass(overview.health)}
            label="Health"
            value={overview.health}
          />
          <Detail label="Hostname" value={overview.hostname} />
          <Detail label="Operating system" value={overview.operatingSystem} />
          <Detail label="Platform" value={overview.platform} />
          <Detail label="Kernel" value={overview.kernel} />
          <Detail label="Uptime" value={formatUptime(overview.uptimeSeconds)} />
          <Detail label="Current time" value={formatDateTime(overview.currentTime)} />
        </dl>
      ) : (
        <p className="description">
          {loading ? "Loading server details..." : "Server details are not loaded yet."}
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function MetricsPanel({ apiRequest }: { apiRequest: ApiRequest }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  async function loadMetrics() {
    setError("");

    try {
      const data = await apiRequest<Metrics>("/api/metrics");

      if (data) {
        setMetrics(data);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load metrics.");
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Metrics</h2>
        <button className="secondary" onClick={loadMetrics}>
          Refresh
        </button>
      </div>

      {metrics && (
        <dl className="detail-list">
          <Detail label="Memory used" value={`${metrics.memoryUsedPercent}%`} />
          <Detail label="Free memory" value={formatBytes(metrics.freeMemory)} />
          <Detail label="Total memory" value={formatBytes(metrics.totalMemory)} />
          <Detail label="System uptime" value={formatUptime(metrics.systemUptimeSeconds)} />
          <Detail label="Process uptime" value={formatUptime(metrics.processUptimeSeconds)} />
          <Detail label="CPU load" value={metrics.cpuLoadAverage.map(round).join(", ")} />
        </dl>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function LogsPanel({ apiRequest }: { apiRequest: ApiRequest }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    setError("");

    try {
      const data = await apiRequest<{ logs: LogEntry[] }>("/api/logs");

      if (data) {
        setLogs(data.logs);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load logs.");
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Logs</h2>
        <button className="secondary" onClick={loadLogs}>
          Refresh
        </button>
      </div>

      <div className="stack">
        {logs.map((log) => (
          <p className={`log-line log-${log.level}`} key={log.id}>
            {formatDateTime(log.createdAt)} - {log.message}
          </p>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function OperationsPanel({ apiRequest }: { apiRequest: ApiRequest }) {
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProcesses() {
    setError("");

    try {
      const data = await apiRequest<{ processes: ProcessRecord[] }>("/api/processes");

      if (data) {
        setProcesses(data.processes);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load processes.");
    }
  }

  async function restartProcess(processId: string) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest<{ message: string }>("/api/processes/" + processId + "/restart", {
        method: "POST",
      });

      if (data) {
        setMessage(data.message);
        await loadProcesses();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not restart process.");
    }
  }

  useEffect(() => {
    void loadProcesses();
  }, []);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Operations</h2>
        <button className="secondary" onClick={loadProcesses}>
          Refresh
        </button>
      </div>

      <div className="stack">
        {processes.map((processRecord) => (
          <div className="row" key={processRecord.id}>
            <div>
              <strong>{processRecord.name}</strong>
              <p className="muted">
                {processRecord.status}
                {processRecord.lastRestartedAt
                  ? ` - restarted ${formatDateTime(processRecord.lastRestartedAt)}`
                  : ""}
              </p>
            </div>
            <button onClick={() => void restartProcess(processRecord.id)}>
              Restart
            </button>
          </div>
        ))}
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function AdminPanel({
  apiRequest,
  currentUser,
}: {
  apiRequest: ApiRequest;
  currentUser: User;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAdminData() {
    setError("");

    try {
      const [usersData, alertsData] = await Promise.all([
        apiRequest<{ users: User[] }>("/api/admin/users"),
        apiRequest<{ alerts: AlertRule[] }>("/api/admin/alerts"),
      ]);

      if (usersData) {
        setUsers(usersData.users);
      }

      if (alertsData) {
        setAlerts(alertsData.alerts);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load admin data.");
    }
  }

  async function changeRole(userId: string, role: Role) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest<{ user: User }>("/api/admin/users/" + userId + "/role", {
        body: JSON.stringify({ role }),
        method: "PATCH",
      });

      if (data) {
        setUsers((current) =>
          current.map((candidate) =>
            candidate.id === data.user.id ? data.user : candidate,
          ),
        );
        setMessage("User role updated.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update role.");
    }
  }

  async function toggleAlert(alert: AlertRule) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest<{ alert: AlertRule }>("/api/admin/alerts/" + alert.id, {
        body: JSON.stringify({ enabled: !alert.enabled }),
        method: "PATCH",
      });

      if (data) {
        setAlerts((current) =>
          current.map((candidate) =>
            candidate.id === data.alert.id ? data.alert : candidate,
          ),
        );
        setMessage("Alert rule updated.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update alert.");
    }
  }

  async function runSystemAction(action: string) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest<{ message: string }>("/api/admin/system-actions", {
        body: JSON.stringify({ action }),
        method: "POST",
      });

      if (data) {
        setMessage(data.message);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not run action.");
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>Users</h2>
          <button className="secondary" onClick={loadAdminData}>
            Refresh
          </button>
        </div>
        <div className="stack">
          {users.map((account) => (
            <div className="row" key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <p className="muted">
                  {account.username} - {account.role}
                </p>
              </div>
              <div className="inline-actions">
                {(["viewer", "operator", "admin"] as Role[]).map((role) => (
                  <button
                    className={account.role === role ? "secondary active-action" : "secondary"}
                    disabled={account.id === currentUser.id}
                    key={role}
                    onClick={() => void changeRole(account.id, role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Alert Rules</h2>
        <div className="stack spaced">
          {alerts.map((alert) => (
            <div className="row" key={alert.id}>
              <div>
                <strong>{alert.name}</strong>
                <p className="muted">{alert.condition}</p>
              </div>
              <button className="secondary" onClick={() => void toggleAlert(alert)}>
                {alert.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>System Actions</h2>
        <div className="actions">
          <button onClick={() => void runSystemAction("run-audit")}>
            Run audit
          </button>
          <button className="secondary" onClick={() => void runSystemAction("clear-cache")}>
            Clear cache
          </button>
          <button className="secondary" onClick={() => void runSystemAction("maintenance-check")}>
            Maintenance check
          </button>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </>
  );
}

function Detail({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function MessagePanel({ message }: { message: string }) {
  return (
    <section className="panel">
      <h2>Unavailable</h2>
      <p className="description">{message}</p>
    </section>
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

function formatBytes(value: number) {
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function round(value: number) {
  return String(Math.round(value * 100) / 100);
}

function getHealthClass(health: ServerOverview["health"]) {
  return `health-${health.toLowerCase()}`;
}

export default App;
