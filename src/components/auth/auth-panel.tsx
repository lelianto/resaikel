'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { ApiError, apiRequest } from '@/lib/api-client';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Sign-in, registration and password reset.
 *
 * The browser authenticates against Firebase, then exchanges the ID token for an
 * httpOnly session cookie through our own endpoint. The token itself never
 * touches our storage, and the cookie is never readable from JavaScript.
 */

type Mode = 'signIn' | 'signUp' | 'reset';

const MODE_COPY: Record<Mode, { title: string; description: string; action: string }> = {
  signIn: {
    title: 'Sign in',
    description: 'Continue to your materials, opportunities and workspace.',
    action: 'Sign in',
  },
  signUp: {
    title: 'Create an account',
    description:
      'You will set your organisation and role next. You can hold more than one role.',
    action: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    description: 'We will email you a link to choose a new password.',
    action: 'Send reset link',
  },
};

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password combination did not match an account.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email address.';
    case 'auth/weak-password':
      return 'Use a password of at least 8 characters.';
    case 'auth/invalid-email':
      return 'That email address does not look valid.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The Google sign-in window was closed before it finished.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment before trying again.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled on this project yet.';
    default:
      return 'We could not complete that sign-in. Please try again.';
  }
}

export function AuthPanel({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const copy = MODE_COPY[mode];

  async function establishSession(idToken: string): Promise<void> {
    await apiRequest('/api/auth/session', { method: 'POST', body: { idToken } });
    router.replace(nextPath);
    router.refresh();
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (email.trim().length < 3) errors.email = 'Enter your email address.';
    if (mode !== 'reset' && password.length < 8) {
      errors.password = 'Passwords are at least 8 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const auth = firebaseAuth();

      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('If an account exists for that address, a reset link is on its way.');
        setMode('signIn');
        return;
      }

      if (mode === 'signUp') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim().length > 0) {
          await updateProfile(credential.user, { displayName: displayName.trim() });
        }
        // Verification is requested, but an unverified address does not block the
        // onboarding flow in development.
        void sendEmailVerification(credential.user).catch(() => undefined);
        const token = await credential.user.getIdToken();
        await establishSession(token);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await credential.user.getIdToken();
      await establishSession(token);
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught !== null && 'code' in caught
          ? String((caught as { code: unknown }).code)
          : '';
      setError(
        caught instanceof ApiError
          ? caught.message
          : code.startsWith('auth/')
            ? friendlyAuthError(code)
            : 'We could not complete that sign-in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(): Promise<void> {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const auth = firebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const token = await credential.user.getIdToken();
      await establishSession(token);
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught !== null && 'code' in caught
          ? String((caught as { code: unknown }).code)
          : '';
      setError(
        caught instanceof ApiError
          ? caught.message
          : code.startsWith('auth/')
            ? friendlyAuthError(code)
            : 'Google sign-in did not complete.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSignOutOfFirebase(): Promise<void> {
    await signOut(firebaseAuth()).catch(() => undefined);
  }

  return (
    <div className="panel p-6 sm:p-7">
      <div className="space-y-1.5">
        <h1 className="text-xl font-medium tracking-[-0.02em] text-ink">{copy.title}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{copy.description}</p>
      </div>

      {error ? (
        <Alert tone="danger" className="mt-5" title="Could not sign you in">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert tone="success" className="mt-5">
          {notice}
        </Alert>
      ) : null}

      {mode !== 'reset' ? (
        <>
          <Button
            variant="outline"
            fullWidth
            className="mt-5"
            loading={busy}
            onClick={() => void onGoogle()}
          >
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="micro-label">or use email</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : (
        <div className="mt-5" />
      )}

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        {mode === 'signUp' ? (
          <Field label="Your name" htmlFor="displayName" hint="Shown on your organisation.">
            <Input
              id="displayName"
              name="name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ada Wijaya"
            />
          </Field>
        ) : null}

        <Field
          label="Email"
          htmlFor="email"
          required
          {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@workshop.id"
            invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        {mode !== 'reset' ? (
          <Field
            label="Password"
            htmlFor="password"
            required
            hint={mode === 'signUp' ? 'At least 8 characters.' : undefined}
            {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              invalid={Boolean(fieldErrors.password)}
            />
          </Field>
        ) : null}

        <Button type="submit" fullWidth loading={busy}>
          {copy.action}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs">
        {mode === 'signIn' ? (
          <>
            <button
              type="button"
              className="text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
              onClick={() => {
                setMode('signUp');
                setError(null);
              }}
            >
              Create an account
            </button>
            <button
              type="button"
              className="text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
              onClick={() => {
                setMode('reset');
                setError(null);
              }}
            >
              Forgot your password?
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            onClick={() => {
              setMode('signIn');
              setError(null);
              void onSignOutOfFirebase();
            }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
