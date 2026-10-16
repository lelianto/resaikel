import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { WorkflowPreview } from '@/components/marketing/workflow-preview';
import { GridBackdrop, SectionRule } from '@/components/signature/annotations';
import { Button } from '@/components/ui/button';
import { Container, SectionHeading } from '@/components/ui/layout';
import { sampleScenarios } from '@/domain/demo/sample-scenarios';
import { FEASIBILITY_LABELS, FEASIBILITY_STATUSES } from '@/domain/feasibility/types';
import { SORT_MODE_LABELS, SORT_MODES } from '@/domain/ranking/rank';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How resaikel turns leftover material into manufacturable products: the pipeline, the gates, ' +
    'the limits, and what happens when the data is not there.',
};

const PIPELINE = [
  {
    step: '01',
    title: 'Photograph and describe',
    body: 'Upload up to four compressed photographs. The vision model describes only what it can see: category, condition, contamination and restrictions. Measurements are deliberately excluded from the prompt, because a photograph cannot establish one.',
    aside: 'Client-side compression, server-side byte-level validation.',
  },
  {
    step: '02',
    title: 'Confirm by hand',
    body: 'You correct and confirm the properties. Every attribute records whether it was AI inferred, user confirmed, measured, or unknown. Confirmation is blocked until critical fields are human verified.',
    aside: 'An AI inference is never treated as a measurement.',
  },
  {
    step: '03',
    title: 'Discover candidates',
    body: 'The model may only select from a curated catalogue of validated specifications, and may only set parameters inside their declared bounds. Anything that cannot be substantiated is rejected before it reaches the engines.',
    aside: 'Unknown templates, out-of-range parameters and unsafe claims are all dropped.',
  },
  {
    step: '04',
    title: 'Apply the gates',
    body: 'Six ordered checks: material family, sheet dimensions, thickness, condition and contamination, whether every panel fits, and whether the stock yields at least one unit. A failure removes the candidate from ranking.',
    aside: 'Rejection reasons are always stated.',
  },
  {
    step: '05',
    title: 'Cost it transparently',
    body: 'Eleven cost lines, each carrying its own assumption and its own derivation. Integer minor units throughout, with a single half-up rounding step. The platform fee is charged on the sale, so it is excluded from production cost.',
    aside: 'Every figure is editable and shows its working.',
  },
  {
    step: '06',
    title: 'Evidence the market',
    body: 'Prices come from a curated reference set, aggregated to a median with 25th and 75th percentiles. Each row is labelled as a transaction, quotation, listing, or estimate, and the set is scored for quality and freshness.',
    aside: 'No evidence produces Insufficient Market Data, not a price.',
  },
  {
    step: '07',
    title: 'Match buyers',
    body: 'Buyer output is a category of buyer with the matched factors shown, or a registered request whose owner consented to be shared. Quantity shortfalls against available capacity are flagged rather than smoothed over.',
    aside: 'No company is named unless it registered itself.',
  },
  {
    step: '08',
    title: 'Rank and explain',
    body: 'Hard gates run before any score. Viable candidates are scored on feasibility, economic value, material utilisation, buyer compatibility, evidence quality, and simplicity, with an explanation per dimension.',
    aside: 'Unknown dimensions are excluded and reported, never scored as zero.',
  },
] as const;

export default function HowItWorksPage() {
  const scenarios = sampleScenarios();

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <GridBackdrop variant="major" className="opacity-70" />
        <Container width="wide" className="relative py-14 sm:py-20">
          <div className="max-w-3xl space-y-5">
            <div className="micro-label">How it works</div>
            <h1 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.5rem]">
              Eight steps, and the order is the point
            </h1>
            <p className="text-[0.9375rem] leading-relaxed text-ink-muted sm:text-base">
              Each step may only use what the step before it established. That is what stops a
              plausible sentence from being mistaken for an engineering result, and it is why a
              candidate can be rejected here even when it sounds like a good idea.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-8">
          <SectionRule index="01" label="Try it on sample data" />
          <SectionHeading
            eyebrow="Live preview"
            title="The real engines, on a fixed input"
            description="These results are computed on this page, now, by the same code the application runs. Only the input is fixed."
          />
          <WorkflowPreview scenarios={scenarios} locale={serverConfig.defaults.locale} />
        </Container>
      </section>

      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="02" label="The pipeline" />
          <ol className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
            {PIPELINE.map((entry) => (
              <li key={entry.step} className="flex gap-5 border-t border-line pt-5">
                <span className="micro-label tnum shrink-0 pt-0.5">{entry.step}</span>
                <div className="space-y-2">
                  <h2 className="text-[0.9375rem] font-medium text-ink">{entry.title}</h2>
                  <p className="text-sm leading-relaxed text-ink-muted">{entry.body}</p>
                  <p className="micro-label text-accent-ink">{entry.aside}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="03" label="Reference" />
          <SectionHeading
            eyebrow="Reference"
            title="The five verdicts, and the five sort modes"
            description="Fifteen words do a lot of work in this product. These are the exact states a candidate can be in, and the exact ways you can order them."
          />

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="micro-label">Feasibility verdicts</h3>
              <dl className="divide-y divide-line">
                {FEASIBILITY_STATUSES.map((status) => (
                  <div key={status} className="py-2.5">
                    <dt className="text-sm font-medium text-ink">{FEASIBILITY_LABELS[status]}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {status === 'process_feasible'
                        ? 'Nests in the stock and every required tool is available. Still an opinion, not a certification.'
                        : status === 'geometrically_feasible'
                          ? 'The parts fit the sheets, but no workshop profile was supplied, so the process could not be verified.'
                          : status === 'conditionally_feasible'
                            ? 'Nests, but tooling is missing, the condition is poor, or defects were recorded but not located.'
                            : status === 'not_feasible'
                              ? 'A hard constraint failed: wrong material family, a panel that cannot be cut, too thin, contaminated, or no unit fits.'
                              : 'Required material properties are still unconfirmed, so nothing is decided either way.'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-3">
              <h3 className="micro-label">Sort modes on the comparison screen</h3>
              <ul className="divide-y divide-line">
                {SORT_MODES.map((mode) => (
                  <li key={mode} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className="text-sm text-ink">{SORT_MODE_LABELS[mode]}</span>
                    <span className="micro-label">dimension value</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-relaxed text-ink-muted">
                Sorting reuses the same normalised dimension values the ranking engine scored, so the
                order on screen can always be traced back to an explanation. Candidates that failed a
                gate stay at the bottom in every mode.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="04" label="Honest limits" />
          <SectionHeading
            eyebrow="Limitations"
            title="What this version does not do"
            description="Stated here rather than discovered later."
          />

          <ul className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
            {[
              'Feasibility is a flat, rectangular, 2D model. No 3D, no structural analysis, no machine nesting file.',
              'Cutting yield assumes a guillotine layout and over-counts waste rather than under-counting it.',
              'Defect positions are not recorded as coordinates, so defects reduce expected yield instead of being excluded from the layout.',
              'Market evidence is a small curated sample set. Live marketplace data is not scraped.',
              'Buyer matching is category-level. Registered demand is the only thing treated as verified.',
              'Commerce is not implemented: no request-for-quotation, no quotation, no payment, no transaction.',
              'Outcome tracking and sustainability metrics are deferred. No carbon figure is claimed.',
              'The AI reads photographs. It cannot verify weight, grade, composition or certification, and it is instructed never to try.',
            ].map((entry) => (
              <li key={entry} className="flex gap-3 border-t border-line pt-4">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-line-strong" />
                <span className="text-sm leading-relaxed text-ink-muted">{entry}</span>
              </li>
            ))}
          </ul>

        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container width="default" className="text-center">
          <div className="space-y-6">
            <SectionHeading
              align="center"
              title="Ready to see it on your own offcuts?"
              description="Scan a material, confirm it by hand, and get products that can be built, costed and sold."
            />
            <Link href="/sign-in">
              <Button size="lg" iconRight={<ArrowRight className="size-4" aria-hidden />}>
                Discover material potential
              </Button>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
