'use client';

import { Camera, ChevronDown, ImagePlus, Info, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert, IndeterminateBar, ProgressBar } from '@/components/ui/feedback';
import { Button, IconButton } from '@/components/ui/button';
import { Field, Input, MeasurementInput, Select, Textarea } from '@/components/ui/form';
import { GridBackdrop } from '@/components/signature/annotations';
import {
  CONDITION_GRADES,
  CONDITION_LABELS,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
} from '@/domain/materials/types';
import type { MaterialCategory, ConditionGrade, QuantityUnit } from '@/domain/materials/types';
import { ApiError, apiRequest, newIdempotencyKey } from '@/lib/api-client';
import {
  ImagePreparationError,
  compressImageFile,
  dedupeFiles,
  formatBytes,
  validateImageFile,
  type CompressedImage,
} from '@/lib/image';

/**
 * Material scanner.
 *
 * Four stages, each with its own visible state: prepare the photographs, create
 * the record, upload and validate each file, then run the analysis job.
 *
 * The upload goes straight from the browser to private storage; the server then
 * re-reads the object and validates its actual bytes, so nothing about the upload
 * is taken on trust.
 */

type Phase = 'form' | 'creating' | 'uploading' | 'analyzing' | 'done' | 'error';

interface DraftPhoto {
  readonly id: string;
  readonly file: File;
  previewUrl: string;
  compressed: CompressedImage | null;
  status: 'pending' | 'compressing' | 'prepared' | 'uploaded' | 'failed';
  message: string | null;
  /** Camera captures are compressed the moment they arrive, not at submit. */
  readonly autoCompress: boolean;
}

const MAX_PHOTOS = 4;

/**
 * Fallback message for an upload failure that is not already an {@link ApiError}
 * (the upload route returns those with a diagnosable message of their own). This
 * only catches unexpected throws, so it logs the raw error and stays generic.
 */
function describeUploadError(caught: unknown): string {
  console.error('Photo upload failed', caught);

  if (caught instanceof Error && caught.message) {
    return `The upload did not complete: ${caught.message}`;
  }
  return 'The upload did not complete.';
}

export function MaterialScanner({ uploadMaxBytes }: { uploadMaxBytes: number }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  // Ids whose on-capture compression is already running, so the effect below
  // never starts a second pass over the same photo.
  const compressingIds = useRef<Set<string>>(new Set());

  const [phase, setPhase] = useState<Phase>('form');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [dragging, setDragging] = useState(false);

  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('unknown');
  const [condition, setCondition] = useState<ConditionGrade>('unknown');
  const [quantityValue, setQuantityValue] = useState('1');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('sheet');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [thicknessMm, setThicknessMm] = useState('');
  const [contamination, setContamination] = useState('');
  const [defects, setDefects] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);
  const [statusLine, setStatusLine] = useState('');
  const [progress, setProgress] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const busy = phase === 'creating' || phase === 'uploading' || phase === 'analyzing';

  // Compress camera captures as soon as they land. A phone photo is large and
  // sometimes HEIC, which many browsers will not render in an <img>; re-encoding
  // to WebP/JPEG here both shrinks it and guarantees the preview displays.
  useEffect(() => {
    for (const photo of photos) {
      if (!photo.autoCompress || photo.status !== 'pending') continue;
      if (compressingIds.current.has(photo.id)) continue;

      const { id, file } = photo;
      compressingIds.current.add(id);
      setPhotos((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, status: 'compressing' } : entry)),
      );

      compressImageFile(file, { allowOversize: true })
        .then((compressed) => {
          setPhotos((current) =>
            current.map((entry) => {
              if (entry.id !== id) return entry;
              // Swap the preview to the re-encoded blob so even HEIC shows.
              URL.revokeObjectURL(entry.previewUrl);
              return {
                ...entry,
                compressed,
                previewUrl: URL.createObjectURL(compressed.blob),
                status: 'prepared',
                message: compressed.compressed
                  ? `Compressed ${formatBytes(compressed.originalBytes)} to ${formatBytes(compressed.blob.size)}`
                  : 'Ready to upload',
              };
            }),
          );
        })
        .catch((caught) => {
          setPhotos((current) =>
            current.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    status: 'failed',
                    message:
                      caught instanceof ImagePreparationError
                        ? caught.message
                        : 'That photograph could not be prepared.',
                  }
                : entry,
            ),
          );
        })
        .finally(() => {
          compressingIds.current.delete(id);
        });
    }
  }, [photos]);

  function addFiles(incoming: FileList | null, options: { camera?: boolean } = {}): void {
    if (!incoming || incoming.length === 0) return;
    setError(null);

    const fromCamera = options.camera === true;
    const candidates = Array.from(incoming);
    const problems: string[] = [];
    const accepted: File[] = [];

    for (const file of candidates) {
      const problem = validateImageFile(file, { allowOversize: fromCamera });
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      accepted.push(file);
    }

    setPhotos((current) => {
      const merged = [...current];
      const additions = dedupeFiles(
        merged.map((photo) => photo.file),
        accepted,
      );

      for (const file of additions) {
        if (merged.length >= MAX_PHOTOS) {
          problems.push(`Only ${MAX_PHOTOS} photographs are analysed at a time.`);
          break;
        }
        merged.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          compressed: null,
          status: 'pending',
          message: fromCamera ? 'Compressing…' : null,
          autoCompress: fromCamera,
        });
      }

      return merged;
    });

    if (problems.length > 0) setError(problems.join(' '));
  }

  function removePhoto(id: string): void {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  function parseList(value: string): string[] {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 20);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (title.trim().length < 2) errors.title = 'Give the material a name you will recognise.';
    const quantity = Number(quantityValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.quantity = 'Enter how much material is available, greater than zero.';
    }
    if (photos.length === 0) errors.photos = 'Add at least one photograph to analyse.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function prepareAndUpload(
    materialId: string,
  ): Promise<{ uploaded: number; failures: number }> {
    let uploaded = 0;
    let failures = 0;

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (!photo) continue;

      setStatusLine(`Preparing photograph ${index + 1} of ${photos.length}`);
      setProgress(Math.round(((index + 0.3) / photos.length) * 100));

      // Camera captures were already compressed on arrival; reuse that result
      // rather than re-encoding an already compressed WebP.
      let compressed: CompressedImage;
      if (photo.compressed) {
        compressed = photo.compressed;
      } else {
        try {
          compressed = await compressImageFile(photo.file);
        } catch (caught) {
          failures += 1;
          setPhotos((current) =>
            current.map((entry) =>
              entry.id === photo.id
                ? {
                    ...entry,
                    status: 'failed',
                    message:
                      caught instanceof ImagePreparationError
                        ? caught.message
                        : 'That photograph could not be prepared.',
                  }
                : entry,
            ),
          );
          continue;
        }
      }

      setPhotos((current) =>
        current.map((entry) =>
          entry.id === photo.id ? { ...entry, compressed, status: 'prepared' } : entry,
        ),
      );

      const blob = compressed.blob;

      try {
        setStatusLine(`Uploading photograph ${index + 1} of ${photos.length}`);
        // The bytes go to our own authenticated route, which stores them with the
        // Admin SDK. The upload rides the session cookie, so it never depends on a
        // live Firebase client session the way a direct-to-storage upload would.
        const form = new FormData();
        form.append('file', blob, compressed.fileName);
        form.append('fileName', compressed.fileName);
        form.append('order', String(index));
        if (compressed.width) form.append('width', String(compressed.width));
        if (compressed.height) form.append('height', String(compressed.height));

        await apiRequest(`/api/materials/${materialId}/photos`, {
          method: 'POST',
          body: form,
        });

        uploaded += 1;
        setPhotos((current) =>
          current.map((entry) =>
            entry.id === photo.id
              ? {
                  ...entry,
                  status: 'uploaded',
                  message: compressed.compressed
                    ? `Compressed ${formatBytes(compressed.originalBytes)} to ${formatBytes(blob.size)}`
                    : 'Uploaded without re-encoding',
                }
              : entry,
          ),
        );
      } catch (caught) {
        failures += 1;
        setPhotos((current) =>
          current.map((entry) =>
            entry.id === photo.id
              ? {
                  ...entry,
                  status: 'failed',
                  message:
                    caught instanceof ApiError ? caught.message : describeUploadError(caught),
                }
              : entry,
          ),
        );
      }

      setProgress(Math.round(((index + 1) / photos.length) * 100));
    }

    return { uploaded, failures };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setBlocking([]);
    if (!validate()) return;

    try {
      setPhase('creating');
      setStatusLine('Creating the material record');

      const created = await apiRequest<{
        material: { id: string };
      }>('/api/materials', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          title: title.trim(),
          origin: origin.trim().length > 0 ? origin.trim() : null,
          notes: notes.trim().length > 0 ? notes.trim() : null,
          category,
          condition,
          contamination: parseList(contamination),
          defects: parseList(defects),
          quantityValue: Number(quantityValue),
          quantityUnit,
          ...(lengthMm.trim().length > 0 ? { lengthMm: Math.round(Number(lengthMm)) } : {}),
          ...(widthMm.trim().length > 0 ? { widthMm: Math.round(Number(widthMm)) } : {}),
          ...(thicknessMm.trim().length > 0
            ? { thicknessMm: Math.round(Number(thicknessMm)) }
            : {}),
        },
      });

      setPhase('uploading');
      const upload = await prepareAndUpload(created.material.id);

      if (upload.uploaded === 0) {
        throw new ApiError(
          'UNSUPPORTED_MEDIA_TYPE',
          'None of the photographs could be uploaded. Remove the failing ones and try again.',
          0,
        );
      }

      setPhase('analyzing');
      setStatusLine('Analysing the material with the vision model');
      setProgress(0);

      const started = await apiRequest<{ jobId: string; cached: boolean }>(
        `/api/materials/${created.material.id}/analyze`,
        { method: 'POST', idempotencyKey: newIdempotencyKey() },
      );

      if (started.cached) {
        setPhase('done');
        setStatusLine('Reused a previous analysis of the same photographs');
      } else {
        await pollJob(started.jobId, created.material.id);
      }

      router.push(`/materials/${created.material.id}`);
      router.refresh();
    } catch (caught) {
      setPhase('error');
      if (caught instanceof ApiError) {
        setError(caught.message);
        setBlocking(caught.blocking);
      } else {
        setError('Something went wrong while preparing this material.');
      }
    }
  }

  async function pollJob(jobId: string, materialId: string): Promise<void> {
    const deadline = Date.now() + 120_000;

    for (;;) {
      if (Date.now() > deadline) {
        setPhase('error');
        setError(
          'The analysis is taking longer than expected. It will keep running on the server; open ' +
            'the material to see the result when it finishes.',
        );
        return;
      }

      const progress = await apiRequest<{
        job: { status: 'queued' | 'running' | 'succeeded' | 'failed'; mock: boolean };
        error: { message: string } | null;
      }>(`/api/analysis/${jobId}`);

      if (progress.job.status === 'succeeded') {
        setPhase('done');
        setStatusLine(
          progress.job.mock
            ? 'Analysed with the offline mock adapter'
            : 'Analysis complete',
        );
        return;
      }

      if (progress.job.status === 'failed') {
        setPhase('error');
        setError(
          progress.error?.message ??
            'The analysis did not complete. You can still enter the material properties by hand.',
        );
        void materialId;
        return;
      }

      setStatusLine(
        progress.job.status === 'queued'
          ? 'Waiting for a worker'
          : 'Reading the photographs',
      );
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }

  const optionalFilled = [
    lengthMm,
    widthMm,
    thicknessMm,
    contamination,
    defects,
    origin,
    notes,
  ].filter((value) => value.trim().length > 0).length;

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-8" noValidate>
      {error ? (
        <Alert tone={phase === 'error' ? 'danger' : 'warning'} title="Not saved yet">
          {error}
          {blocking.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {blocking.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {/* ----------------------------------------------------------- photographs */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="micro-label">01 — Photographs</h2>
          <span className="micro-label tnum">
            {photos.length} / {MAX_PHOTOS}
          </span>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={[
            'relative isolate overflow-hidden rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-primary bg-primary-soft/50' : 'border-line-strong bg-surface',
          ].join(' ')}
        >
          <GridBackdrop className="opacity-50" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-surface-subtle text-ink-muted">
              <ImagePlus className="size-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">Drop photographs here</p>
              <p className="text-xs text-ink-muted">
                Up to {MAX_PHOTOS} images, {formatBytes(uploadMaxBytes)} each. They are compressed in
                your browser before upload and stored privately.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconLeft={<ImagePlus className="size-4" aria-hidden />}
                onClick={() => fileInput.current?.click()}
              >
                Choose files
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<Camera className="size-4" aria-hidden />}
                onClick={() => cameraInput.current?.click()}
              >
                Use camera
              </Button>
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files, { camera: true });
              event.target.value = '';
            }}
          />
        </div>

        {fieldErrors.photos ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {fieldErrors.photos}
          </p>
        ) : null}

        {photos.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="flex gap-3 rounded-md border border-line bg-surface p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={`Photograph ${index + 1} of ${title || 'the material'}`}
                  className="size-20 shrink-0 rounded-sm border border-line object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs font-medium text-ink">{photo.file.name}</p>
                  <p className="micro-label tnum">
                    {formatBytes(photo.file.size)}
                    {photo.compressed && photo.compressed.compressed
                      ? ` → ${formatBytes(photo.compressed.blob.size)}`
                      : ''}
                  </p>
                  {photo.message ? (
                    <p
                      className={[
                        'text-xs leading-snug',
                        photo.status === 'failed' ? 'text-danger' : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {photo.message}
                    </p>
                  ) : (
                    <p className="micro-label">
                      {photo.status === 'uploaded' ? 'Ready' : 'Queued'}
                    </p>
                  )}
                </div>
                <IconButton
                  label={`Remove photograph ${index + 1}`}
                  size="sm"
                  disabled={busy}
                  onClick={() => removePhoto(photo.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* --------------------------------------------------------------- details */}
      <section className="space-y-4">
        <h2 className="micro-label">02 — What you already know</h2>

        <Field
          label="Material name"
          htmlFor="title"
          required
          hint="A description you will recognise later, such as “Plywood offcuts from a wardrobe job”."
          {...(fieldErrors.title ? { error: fieldErrors.title } : {})}
        >
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Plywood offcuts from a wardrobe job"
            invalid={Boolean(fieldErrors.title)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" required>
            <Select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as MaterialCategory)}
            >
              {MATERIAL_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {MATERIAL_CATEGORY_LABELS[entry]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Condition" htmlFor="condition" required>
            <Select
              id="condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value as ConditionGrade)}
            >
              {CONDITION_GRADES.map((entry) => (
                <option key={entry} value={entry}>
                  {CONDITION_LABELS[entry]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantity available"
            htmlFor="quantity"
            required
            {...(fieldErrors.quantity ? { error: fieldErrors.quantity } : {})}
          >
            <Input
              id="quantity"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={quantityValue}
              onChange={(event) => setQuantityValue(event.target.value)}
              invalid={Boolean(fieldErrors.quantity)}
            />
          </Field>

          <Field label="Counted in" htmlFor="quantityUnit" required>
            <Select
              id="quantityUnit"
              value={quantityUnit}
              onChange={(event) => setQuantityUnit(event.target.value as QuantityUnit)}
            >
              {QUANTITY_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {QUANTITY_UNIT_LABELS[unit]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* ------------------------------------------------------ optional details */}
      <details className="group rounded-lg border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-baseline gap-2">
            <span className="micro-label">03 — More detail</span>
            <span className="text-xs text-ink-muted">
              Dimensions, contamination, defects, origin, notes
            </span>
          </span>
          <span className="flex items-center gap-2">
            {optionalFilled > 0 ? (
              <span className="micro-label tnum rounded-full bg-primary-soft px-2 py-0.5 text-primary">
                {optionalFilled} added
              </span>
            ) : (
              <span className="text-[0.6875rem] font-normal text-ink-faint">optional</span>
            )}
            <ChevronDown
              className="size-4 text-ink-muted transition-transform group-open:rotate-180"
              aria-hidden
            />
          </span>
        </summary>

        <div className="space-y-4 border-t border-line px-4 pb-5 pt-4">
          <Alert tone="info">
            <span className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Measure the sheet yourself if you can. A photograph cannot establish a dimension, and
                resaikel will not estimate one. Leaving these blank is fine — you can confirm them on
                the next screen.
              </span>
            </span>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Length" htmlFor="lengthMm">
            <MeasurementInput
              id="lengthMm"
              value={lengthMm}
              onChange={(event) => setLengthMm(event.target.value)}
              placeholder="600"
            />
          </Field>
          <Field label="Width" htmlFor="widthMm">
            <MeasurementInput
              id="widthMm"
              value={widthMm}
              onChange={(event) => setWidthMm(event.target.value)}
              placeholder="400"
            />
          </Field>
          <Field label="Thickness" htmlFor="thicknessMm">
            <MeasurementInput
              id="thicknessMm"
              value={thicknessMm}
              onChange={(event) => setThicknessMm(event.target.value)}
              placeholder="12"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Contamination"
            htmlFor="contamination"
            hint="Comma separated. Oil, paint residue, mould and similar will block reuse."
          >
            <Input
              id="contamination"
              value={contamination}
              onChange={(event) => setContamination(event.target.value)}
              placeholder="oil staining, tape residue"
            />
          </Field>

          <Field label="Defects" htmlFor="defects" hint="Comma separated visible damage.">
            <Input
              id="defects"
              value={defects}
              onChange={(event) => setDefects(event.target.value)}
              placeholder="chipped corner, delamination"
            />
          </Field>
        </div>

        <Field label="Origin" htmlFor="origin" hint="Where it came from. Useful context later.">
          <Input
            id="origin"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="Cabinet workshop, Cikarang"
          />
        </Field>

          <Field label="Notes" htmlFor="notes" hint="Anything else worth recording.">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Stored indoors, wrapped in cardboard for two months."
            />
          </Field>
        </div>
      </details>

      {/* ---------------------------------------------------------------- submit */}
      <section className="space-y-4 border-t border-line pt-6">
        {busy || phase === 'done' ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-ink">{statusLine}</p>
              <span className="micro-label tnum">{progress}%</span>
            </div>
            {phase === 'analyzing' ? (
              <IndeterminateBar />
            ) : (
              <ProgressBar value={progress} label={statusLine} />
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={busy} disabled={photos.length === 0}>
            Analyse this material
          </Button>
          <p className="text-xs text-ink-faint">
            Nothing is evaluated until you confirm the properties on the next screen.
          </p>
        </div>
      </section>
    </form>
  );
}
