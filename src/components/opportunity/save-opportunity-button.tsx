'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Save to workspace.
 *
 * Optimistic, with a rollback on failure so the button never lies about what was
 * persisted.
 */
export function SaveOpportunityButton({
  opportunityId,
  initialSaved,
  fullWidth = true,
}: {
  opportunityId: string;
  initialSaved: boolean;
  fullWidth?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(): Promise<void> {
    const next = !saved;
    setSaved(next);
    setBusy(true);
    setError(null);

    try {
      await apiRequest(`/api/opportunities/${opportunityId}/save`, {
        method: 'POST',
        body: { saved: next },
      });
    } catch (caught) {
      setSaved(!next);
      setError(caught instanceof ApiError ? caught.message : 'That save could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant={saved ? 'outline' : 'primary'}
        fullWidth={fullWidth}
        loading={busy}
        iconLeft={
          saved ? (
            <BookmarkCheck className="size-4" aria-hidden />
          ) : (
            <Bookmark className="size-4" aria-hidden />
          )
        }
        onClick={() => void toggle()}
      >
        {saved ? 'Saved to workspace' : 'Save to workspace'}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
