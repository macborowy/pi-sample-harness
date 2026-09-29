import cors from 'cors';
import express from 'express';
import { hostname } from 'node:os';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const appVersion = process.env.APP_VERSION ?? '0.0.0';

app.use(
  cors({
    origin: webOrigin,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/account/me', (_req, res) => {
  res.json({ username: 'maciej' });
});

app.get('/api/version', (_req, res) => {
  res.json({ version: appVersion });
});

app.get('/api/message', (_req, res) => {
  res.json({ message: 'Hello' });
});

app.get('/debug', (_req, res) => {
  res.json({
    time: new Date().toISOString(),
    hostname: hostname(),
    version: appVersion,
    randomNumber: Math.random(),
  });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
