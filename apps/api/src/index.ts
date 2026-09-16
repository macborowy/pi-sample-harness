import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

app.use(
  cors({
    origin: webOrigin,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
