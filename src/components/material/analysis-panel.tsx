'use client';

import { AlertTriangle, Bot, RefreshCw, ScanSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, IndeterminateBar } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ApiError, apiRequest, newIdempotencyKey } from '@/lib/api-client';

/**
 * Analysis panel.
 *
 * Shows what the vision model produced, and re-runs it on request. The model's
 * output is presented as *observations with per-field confidence*, never as
 * established fact, and any measurement-like claim it made in prose is surfaced
 * explicitly as having been discarded.
 */

export interface AnalysisView {
  readonly model: string;
  readonly mock: boolean;
  readonly finishedAt: string | null;
  readonly unsupportedClaims: readonly string[];
  readonly output: {
    readonly category: string;
    readonly subtype: string | null;
    readonly condition: string;
    readonly contamination: readonly string[];
    readonly defects: readonly string[];
    readonly reuseRestrictions: readonly string[];
    readonly visibleEvidence: readonly string[];
    readonly missingInformation: readonly string[];
    readonly warnings: readonly string[];
    readonly fieldConfidence: Readonly<Record<string, number>>;
    readonly notes: string | null;
  } | null;
  readonly error: { code: string; message: string; details: readonly string[] } | null;
}

export function AnalysisPanel({
  materialId,
  photoCount,
  analysis,
  running,
}: {
  materialId: string;
  photoCount: number;
  analysis: AnalysisView | null;
  running: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    setError(null);
    setStatus('Queued');

    try {
      const started = await apiRequest<{ jobId: string; cached: boolean }>(
        `/api/materials/${materialId}/analyze`,
        { method: 'POST', idempotencyKey: newIdempotencyKey() },
      );

      if (started.cached) {
        setStatus('Reused a previous analysis of the same photographs');
        router.refresh();
        return;
      }

      const deadline = Date.now() + 120_000;
      for (;;) {
        if (Date.now() > deadline) {
          setStatus('Still running on the server. Reload this page shortly.');
          break;
        }

        const progress = await apiRequest<{ job: { status: string; mock: boolean } }>(
          `/api/analysis/${started.jobId}`,
        );

        if (progress.job.status === 'succeeded') {
          setStatus(
            progress.job.mock ? 'Complete (offline mock adapter)' : 'Analysis complete',
          );
          router.refresh();
          break;
        }
        if (progress.job.status === 'failed') {
          setError('The analysis did not complete. You can still confirm the properties by hand.');
          break;
        }

        setStatus(progress.job.status === 'queued' ? 'Waiting for a worker' : 'Reading the photographs');
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The analysis could not be started. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const output = analysis?.output ?? null;
  const canRun = photoCount > 0 && !busy && !running;

  return (
    <Card>
      <CardHeader
        eyebrow="Material intelligence"
        title="What the model could see"
        description="Descriptions only. A photograph cannot establish a dimension, a weight or a strength, so resaikel does not accept one from it."
        actions={
          <Button
            size="sm"
            variant={output ? 'outline' : 'primary'}
            loading={busy}
            disabled={!canRun}
            iconLeft={<ScanSearch className="size-4" aria-hidden />}
            onClick={() => void run()}
          >
            {output ? 'Re-analyse' : 'Analyse photographs'}
          </Button>
        }
      />

      <CardBody className="space-y-5">
        {photoCount === 0 ? (
          <Alert tone="info" title="No photographs yet">
            Add at least one photograph from the scan screen, then run the analysis.
          </Alert>
        ) : null}

        {busy || running ? (
          <div className="space-y-2">
            <p className="text-sm text-ink">{status ?? 'Working'}</p>
            <IndeterminateBar />
          </div>
        ) : null}

        {error ? (
          <Alert tone="warning" title="Analysis unavailable">
            {error}
          </Alert>
        ) : null}

        {analysis?.error && !output ? (
          <Alert tone="warning" title={`Analysis failed (${analysis.error.code})`}>
            {analysis.error.message}
            {analysis.error.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {analysis.error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        {output ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
              <span className="micro-label">Ran with</span>
              <span className="font-mono text-[0.6875rem] text-ink-muted">{analysis?.model}</span>
              {analysis?.mock ? (
                <span className="micro-label text-accent-ink">
                  offline mock adapter — no model was called
                </span>
              ) : null}
            </div>

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                { label: 'Category', value: output.category, key: 'category' },
                { label: 'Subtype', value: output.subtype, key: 'subtype' },
                { label: 'Condition', value: output.condition, key: 'condition' },
                {
                  label: 'Contamination',
                  value: output.contamination.length > 0 ? output.contamination.join(', ') : 'None visible',
                  key: 'contamination',
                },
                {
                  label: 'Defects',
                  value: output.defects.length > 0 ? output.defects.join(', ') : 'None visible',
                  key: 'defects',
                },
              ].map((row) => {
                const confidence = output.fieldConfidence[row.key];
                return (
                  <div key={row.key} className="space-y-1">
                    <dt className="micro-label">{row.label}</dt>
                    <dd className="text-sm text-ink">{row.value}</dd>
                    <dd className="micro-label">
                      {confidence !== undefined
                        ? `model confidence ${Math.round(confidence * 100)}%`
                        : 'no confidence reported'}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {output.visibleEvidence.length > 0 ? (
              <div className="space-y-1.5">
                <h3 className="micro-label">What it based that on</h3>
                <ul className="space-y-1 text-sm text-ink-muted">
                  {output.visibleEvidence.map((entry) => (
                    <li key={entry} className="flex gap-2">
                      <Bot className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                      {entry}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {output.missingInformation.length > 0 ? (
              <Alert tone="warning" title="Still needed from you">
                <ul className="list-disc space-y-1 pl-4">
                  {output.missingInformation.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {analysis && analysis.unsupportedClaims.length > 0 ? (
              <Alert tone="warning" title="Discarded model claims">
                <p className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    The model mentioned measurements it cannot know
                    {` (${analysis.unsupportedClaims.join(', ')})`}. They were discarded and are not
                    recorded anywhere as facts.
                  </span>
                </p>
              </Alert>
            ) : null}

            {output.reuseRestrictions.length > 0 ? (
              <div className="space-y-1.5">
                <h3 className="micro-label">Reuse restrictions</h3>
                <ul className="space-y-1 text-sm text-ink-muted">
                  {output.reuseRestrictions.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {!output && !busy && photoCount > 0 ? (
          <p className="text-sm text-ink-muted">
            No analysis yet. Running it will describe the material from the photographs and cost one
            model call; identical photographs are cached and never billed twice.
          </p>
        ) : null}

        <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-ink-faint">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Re-running on the same photographs is free: the analysis is cached against a hash of the
          images, the prompt version and the model.
        </p>
      </CardBody>
    </Card>
  );
}
