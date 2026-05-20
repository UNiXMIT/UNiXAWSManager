import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import instancesRouter from './routes/instances.js';
import securityGroupsRouter from './routes/securityGroups.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve built React frontend in production
const staticPath = join(__dirname, 'public');
if (existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/config', (_req, res) => {
  res.json({
    defaultOwner: process.env.DEFAULT_OWNER || 'MTURNER',
    defaultRegion: process.env.DEFAULT_REGION || 'eu-west-2',
  });
});

app.use('/api/instances', instancesRouter);
app.use('/api/security-groups', securityGroupsRouter);

app.get('/api/myip', async (_req, res) => {
  try {
    const response = await fetch('https://checkip.amazonaws.com/');
    const ip = (await response.text()).trim();
    res.json({ ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback: serve index.html for client-side routes
if (existsSync(staticPath)) {
  app.get('*', (_req, res) => res.sendFile(join(staticPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`AWS Manager server running on http://localhost:${PORT}`);
  if (existsSync(staticPath)) {
    console.log('Serving React frontend from /public');
  }
});
