import { Router } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const router = Router();

// Per-request Semaphore token supplied by the browser (falls back to env).
router.use((req, _res, next) => {
  req.semToken = req.get('x-semaphore-token') || undefined;
  next();
});

function getConfig(tokenOverride) {
  const endpoint = process.env.SEMAPHORE_API_ENDPOINT;
  const token = tokenOverride || process.env.SEMAPHORE_API_TOKEN;
  if (!endpoint) throw new Error('SEMAPHORE_API_ENDPOINT is not configured');
  if (!token) throw new Error('No Semaphore API token configured.');
  return { endpoint: endpoint.replace(/\/$/, ''), token };
}

function semFetch(method, path, body, tokenOverride) {
  return new Promise((resolve, reject) => {
    const { endpoint, token } = getConfig(tokenOverride);
    const url = new URL(`${endpoint}${path}`);
    const insecure = process.env.SEMAPHORE_API_INSECURE === 'true';
    const transport = url.protocol === 'https:' ? https : http;
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      rejectUnauthorized: !insecure,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Semaphore API error ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(data ? JSON.parse(data) : null);
        } catch {
          reject(new Error(`Invalid JSON from Semaphore API: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// GET /api/semaphore/projects
router.get('/projects', async (req, res) => {
  try {
    res.json(await semFetch('GET', '/projects', undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/views
router.get('/projects/:projectId/views', async (req, res) => {
  try {
    res.json(await semFetch('GET', `/project/${req.params.projectId}/views`, undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/templates
router.get('/projects/:projectId/templates', async (req, res) => {
  try {
    res.json(await semFetch('GET', `/project/${req.params.projectId}/templates`, undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/users
router.get('/projects/:projectId/users', async (req, res) => {
  try {
    res.json(await semFetch('GET', `/project/${req.params.projectId}/users`, undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/semaphore/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const { templateId, vmCount, userRegion } = req.body;
    const projectId = parseInt(req.params.projectId, 10);
    const payload = {
      template_id: templateId,
      project_id: projectId,
      environment: JSON.stringify({
        vmCount: String(vmCount ?? 1),
        userRegion: String(userRegion ?? 1),
      }),
    };
    res.json(await semFetch('POST', `/project/${projectId}/tasks`, payload, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/tasks/last
// NOTE: must be declared before /:taskId to avoid route shadowing
router.get('/projects/:projectId/tasks/last', async (req, res) => {
  try {
    const parsed = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 5;
    const tasks = await semFetch('GET', `/project/${req.params.projectId}/tasks/last`, undefined, req.semToken);
    res.json((tasks || []).slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/tasks/:taskId
router.get('/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    res.json(await semFetch('GET', `/project/${req.params.projectId}/tasks/${req.params.taskId}`, undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semaphore/projects/:projectId/tasks/:taskId/output
router.get('/projects/:projectId/tasks/:taskId/output', async (req, res) => {
  try {
    res.json(await semFetch('GET', `/project/${req.params.projectId}/tasks/${req.params.taskId}/output`, undefined, req.semToken));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
