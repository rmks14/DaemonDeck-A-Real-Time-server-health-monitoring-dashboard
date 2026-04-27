import { useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

type ApiStatus = {
  status: string;
};

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [error, setError] = useState("");

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

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Simple Auth Starter</p>
        <h1>Frontend and backend are ready.</h1>
        <p className="description">
          This is a small React + Express setup. Auth, roles, and database can be
          added later without changing the whole structure.
        </p>

        <div className="actions">
          <button onClick={checkBackend}>Check backend</button>
        </div>

        {apiStatus && (
          <p className="success">Backend health: {apiStatus.status}</p>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

export default App;
