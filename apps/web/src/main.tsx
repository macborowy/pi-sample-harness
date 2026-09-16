import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

type HealthResponse = {
  status: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function App() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error(`API zwróciło status HTTP ${response.status}`);
        }

        const data = (await response.json()) as HealthResponse;
        setStatus(data.status);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Nieznany błąd połączenia');
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
  }, []);

  return (
    <main className="app">
      <section className="card">
        <p className="eyebrow">GET /health</p>
        <h1>Status API</h1>
        {loading && <p>Sprawdzanie połączenia...</p>}
        {!loading && status && <p className="success">API działa: {status}</p>}
        {!loading && error && <p className="error">Błąd połączenia: {error}</p>}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
