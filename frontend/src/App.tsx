import { FormEvent, useEffect, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const tokenStorageKey = "simple-auth-token";

type ApiStatus = {
  status: string;
};

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
};

type MeResponse = {
  user: User;
};

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);

    if (!storedToken) {
      return;
    }

    fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${storedToken}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          localStorage.removeItem(tokenStorageKey);
          return;
        }

        const data = (await response.json()) as MeResponse;
        setCurrentUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem(tokenStorageKey);
      });
  }, []);

  async function checkBackend() {
    setError("");

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

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAuthMessage("");
    setIsSubmitting(true);

    try {
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
      setCurrentUser(data.user);
      setIdentifier("");
      setPassword("");
      setAuthMessage(`Signed in as ${data.user.username}.`);
    } catch (caughtError) {
      setCurrentUser(null);
      localStorage.removeItem(tokenStorageKey);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    const storedToken = localStorage.getItem(tokenStorageKey);
    setError("");
    setAuthMessage("");

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

    localStorage.removeItem(tokenStorageKey);
    setCurrentUser(null);
    setAuthMessage("Signed out.");
  }

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Simple Auth Starter</p>
        <h1>{currentUser ? `Welcome, ${currentUser.name}` : "Sign in"}</h1>
        <p className="description">
          Use the demo account until a database is added: demo or
          demo@example.com with password123.
        </p>

        {currentUser ? (
          <div className="account">
            <dl>
              <div>
                <dt>Username</dt>
                <dd>{currentUser.username}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{currentUser.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{currentUser.role}</dd>
              </div>
            </dl>

            <button className="secondary" onClick={logout}>
              Logout
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={login}>
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
        )}

        <div className="actions">
          <button onClick={checkBackend}>Check backend</button>
        </div>

        {apiStatus && (
          <p className="success">Backend health: {apiStatus.status}</p>
        )}

        {authMessage && <p className="success">{authMessage}</p>}

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

export default App;
