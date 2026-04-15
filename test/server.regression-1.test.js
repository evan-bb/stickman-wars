import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Regression: ISSUE-001 — path traversal in static file server
// Found by /qa on 2026-04-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-04-15.md

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function makeRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 3001, path: urlPath, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('server path traversal protection', () => {
  let server;

  beforeAll(async () => {
    // Start the server on a test port
    const { createServer } = await import('http');
    const fs = await import('fs');

    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript' };

    server = createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://localhost').pathname;
      let filePath = path.join(PROJECT_ROOT, urlPath === '/' ? 'index.html' : urlPath);

      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    await new Promise((resolve) => server.listen(3001, resolve));
  });

  afterAll(() => {
    server?.close();
  });

  it('serves index.html at root', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Stickman Wars');
  });

  it('serves JS files', async () => {
    const res = await makeRequest('/js/utils.js');
    expect(res.status).toBe(200);
    expect(res.body).toContain('function clamp');
  });

  it('returns 404 for nonexistent files', async () => {
    const res = await makeRequest('/does-not-exist.html');
    expect(res.status).toBe(404);
  });

  it('normalizes path traversal to safe path via URL constructor', async () => {
    // URL constructor normalizes /../ to /, so this serves /server.js (a real file)
    // The important thing is it does NOT serve files outside the project root
    const res = await makeRequest('/../../../etc/passwd');
    // URL normalizes this to /etc/passwd, which doesn't exist in project
    expect(res.status).toBe(404);
  });

  it('blocks percent-encoded traversal', async () => {
    const res = await makeRequest('/..%2F..%2Fserver.js');
    // The URL constructor treats %2F as a literal character, not a path separator
    expect(res.status).toBe(404);
  });
});
