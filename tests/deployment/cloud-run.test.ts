import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Cloud Run delivery contract', () => {
  it('keeps Next.js ambient image declarations available in a clean checkout', () => {
    expect(read('.gitignore')).not.toMatch(/^next-env\.d\.ts$/m);
    expect(read('next-env.d.ts')).toContain('next/image-types/global');
  });

  it('builds a standalone server that listens on the Cloud Run port', () => {
    const dockerfile = read('Dockerfile');
    expect(read('next.config.ts')).toContain("output: 'standalone'");
    expect(dockerfile).toContain('PORT=8080');
    expect(dockerfile).toContain('HOSTNAME=0.0.0.0');
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).toContain('USER nextjs');
  });

  it('deploys main through keyless GitHub OIDC only after verification', () => {
    const workflow = read('.github/workflows/deploy-cloud-run.yml');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('google-github-actions/auth@v3');
    expect(workflow).toContain('workload_identity_provider:');
    expect(workflow).toContain('needs: verify');
    expect(workflow).not.toContain('credentials_json');
    expect(workflow).toContain('--cpu 2');
    expect(workflow).toContain('--memory 2Gi');
    expect(workflow).toContain('--concurrency 80');
    expect(workflow).toContain('--min 0');
    expect(workflow).toContain('--max 3');
  });

  it('uses Cloud Run service identity instead of an Admin SDK key', () => {
    expect(read('src/server/firebase/admin.ts')).toContain('applicationDefault()');
    const workflow = read('.github/workflows/deploy-cloud-run.yml');
    expect(workflow).toContain('--service-account');
    expect(workflow).not.toContain('FIREBASE_PRIVATE_KEY');
  });
});
