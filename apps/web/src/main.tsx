import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

type MessageResponse = {
  message: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function App() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessage() {
      try {
        const response = await fetch(`${apiUrl}/api/message`);

        if (!response.ok) {
          throw new Error(`API zwróciło status HTTP ${response.status}`);
        }

        const data = (await response.json()) as MessageResponse;
        setMessage(data.message);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Nieznany błąd połączenia');
      } finally {
        setLoading(false);
      }
    }

    fetchMessage();
  }, []);

  return (
    <main className="app">
      <section className="card">
        <p className="eyebrow">GET /api/message</p>
        <h1>Wiadomość z API</h1>
        {loading && <p>Pobieranie wiadomości...</p>}
        {!loading && message && <p className="success">{message}</p>}
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
