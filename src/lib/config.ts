/**
 * Typed access to environment configuration.
 *
 * Design notes
 * ------------
 *  * Nothing here throws at import time. A missing secret should degrade
 *    gracefully in development rather than crash the server on boot; the
 *    explicit `assertProductionEnv()` guard is called from the server-only
 *    Firebase bootstrap, which is where a misconfiguration is fatal.
 *  * `NEXT_PUBLIC_*` values are inlined by Next at build time, so they must be
 *    read as whole static expressions. Do not build them dynamically.
 *  * Model ids are configurable by design - an outdated Gemini model must be
 *    swappable without a code change.
 */

function envNum(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const isEmulatorMode = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'resaikel-dev';

export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || 'demo-api-key',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.appspot.com`,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || 'demo-app-id',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '000000000000',
} as const;

export const emulatorConfig = {
  authHost: '127.0.0.1',
  authPort: 9099,
  firestoreHost: '127.0.0.1',
  firestorePort: 8080,
  storageHost: '127.0.0.1',
  storagePort: 9199,
} as const;

export type AiMode = 'auto' | 'live' | 'mock';

function parseAiMode(raw: string | undefined): AiMode {
  return raw === 'live' || raw === 'mock' ? raw : 'auto';
}

const aiMode = parseAiMode(process.env.AI_MODE);
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? '';

/** True when a real Gemini request should be attempted. */
export function isAiLive(): boolean {
  if (aiMode === 'mock') return false;
  if (aiMode === 'live') return true;
  return geminiApiKey.length > 0;
}

export const serverConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID?.trim() || projectId,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? '',
  privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim(),
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.appspot.com`,

  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'resaikel_session',
  sessionMaxAgeMs: envNum(process.env.SESSION_MAX_AGE_MS, 5 * 24 * 60 * 60 * 1000),
  /** Sessions older than this are forced to refresh, independent of maxAge. */
  sessionRefreshAfterMs: 24 * 60 * 60 * 1000,

  ai: {
    mode: aiMode,
    apiKey: geminiApiKey,
    materialModel: process.env.GEMINI_MATERIAL_MODEL?.trim() || 'gemini-2.5-flash-lite',
    discoveryModel: process.env.GEMINI_DISCOVERY_MODEL?.trim() || 'gemini-2.5-flash',
    explanationModel: process.env.GEMINI_EXPLANATION_MODEL?.trim() || 'gemini-2.5-flash',
    timeoutMs: envNum(process.env.AI_TIMEOUT_MS, 45_000),
    maxAttempts: envNum(process.env.AI_MAX_ATTEMPTS, 3),
    dailyQuotaPerUser: envNum(process.env.AI_DAILY_QUOTA_PER_USER, 50),
    maxCandidates: envNum(process.env.AI_MAX_CANDIDATES, 5),
    /** A job claimed but not finished within this window is considered stale. */
    jobStaleAfterMs: 3 * 60 * 1000,
  },

  upload: {
    maxBytes: envNum(process.env.UPLOAD_MAX_BYTES, 8 * 1024 * 1024),
    maxEdgePx: envNum(process.env.UPLOAD_MAX_EDGE_PX, 1600),
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ] as const,
  },

  rateLimit: {
    requestsPerMinute: envNum(process.env.RATE_LIMIT_PER_MINUTE, 60),
  },

  defaults: {
    currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim() || 'IDR',
    country: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim() || 'ID',
    locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim() || 'id-ID',
  },
} as const;

export const publicConfig = {
  currency: serverConfig.defaults.currency,
  country: serverConfig.defaults.country,
  locale: serverConfig.defaults.locale,
  isEmulatorMode,
} as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Validates the configuration required outside the emulator suite. Called from
 * the Admin SDK bootstrap so that a misconfigured deployment fails loudly at the
 * first privileged operation instead of silently denying every request.
 */
export function assertProductionEnv(): void {
  if (isEmulatorMode) return;

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) missing.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required production environment variables: ${missing.join(', ')}. ` +
        'Set NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true for local development.',
    );
  }
}

/** Short-lived signed URL lifetime for private material photography. */
export const PHOTO_URL_TTL_MS = 5 * 60 * 1000;
