import {
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Compass,
  Factory,
  MessageCircle,
  MinusCircle,
  Package,
  Ruler,
  Sparkle,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import rekaMascot from '../../../assets/reka-bowerbird-mascot.png';

import { WorkflowPreview } from '@/components/marketing/workflow-preview';
import { SectionRule } from '@/components/signature/annotations';
import { Button } from '@/components/ui/button';
import { Container, SectionHeading } from '@/components/ui/layout';
import { getTemplate } from '@/domain/catalog';
import { sampleScenarios } from '@/domain/demo/sample-scenarios';
import { FEASIBILITY_LABELS, FEASIBILITY_STATUSES } from '@/domain/feasibility/types';
import { SORT_MODE_LABELS, SORT_MODES } from '@/domain/ranking/rank';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: 'resaikel | turn waste into worth',
  description:
    'resaikel transforms leftover materials into manufacturable products and real business ' +
    'opportunities through AI-powered material, production and market intelligence.',
};

const INTELLIGENCES = [
  {
    index: '01',
    title: 'Material',
    icon: Boxes,
    body: 'Reads category, condition and contamination from your photos — and refuses to guess dimensions.',
  },
  {
    index: '02',
    title: 'Product',
    icon: Ruler,
    body: 'Proposes products only from a validated catalogue, inside declared bounds. Never invented geometry.',
  },
  {
    index: '03',
    title: 'Manufacturing',
    icon: Factory,
    body: 'Runs deterministic gates, then nests real parts with real kerf. No fit, no pass.',
  },
  {
    index: '04',
    title: 'Market',
    icon: Package,
    body: 'Prices only from labelled evidence. None? “Insufficient Market Data”, never a guess.',
  },
  {
    index: '05',
    title: 'Buyer',
    icon: Users,
    body: 'Names buyer categories and consented demand — never a brand that hasn’t asked.',
  },
] as const;

const EXAMPLE_TEMPLATE_IDS = [
  'cardboard-packaging-insert',
  'cardboard-shipping-box-small',
  'sheetwood-phone-stand',
  'sheetwood-desk-organiser',
  'sheetwood-coaster-set',
  'sheetwood-display-shelf-small',
] as const;

const PIPELINE = [
  {
    step: '01',
    title: 'Photograph and describe',
    body: 'Up to four photos. The model reports only what it can see — never a measurement.',
    aside: 'Client-side compression, server-side byte-level validation.',
  },
  {
    step: '02',
    title: 'Confirm by hand',
    body: 'You verify every property. Each field is tagged inferred, confirmed, measured, or unknown.',
    aside: 'An AI inference is never treated as a measurement.',
  },
  {
    step: '03',
    title: 'Discover candidates',
    body: 'The model picks only from the validated catalogue, inside declared bounds. The rest is dropped.',
    aside: 'Unknown templates, out-of-range parameters and unsafe claims are all dropped.',
  },
  {
    step: '04',
    title: 'Apply the gates',
    body: 'Six ordered checks, from material family to one-unit yield. Any failure drops the candidate.',
    aside: 'Rejection reasons are always stated.',
  },
  {
    step: '05',
    title: 'Cost it transparently',
    body: 'Eleven cost lines, each showing its working. Integer minor units, one rounding step.',
    aside: 'Every figure is editable and shows its working.',
  },
  {
    step: '06',
    title: 'Evidence the market',
    body: 'A labelled reference set, aggregated to a median with p25/p75 and a freshness score.',
    aside: 'No evidence produces Insufficient Market Data, not a price.',
  },
  {
    step: '07',
    title: 'Match buyers',
    body: 'Buyer categories, or consented registered demand. Capacity shortfalls are flagged, not hidden.',
    aside: 'No company is named unless it registered itself.',
  },
  {
    step: '08',
    title: 'Rank and explain',
    body: 'Gates first, then a score per dimension — each with its own explanation.',
    aside: 'Unknown dimensions are excluded and reported, never scored as zero.',
  },
] as const;

const IMPACT_MEASURED = [
  'Confirmed material records and quantities',
  'Sheet area allocated to products',
  'Material consumed by completed builds',
  'Cutting waste from the nesting engine',
] as const;

const IMPACT_NOT_CLAIMED = [
  'Carbon emissions avoided',
  'Landfill diversion without a reuse record',
  'Certification or regulatory compliance',
  'Impact from an AI recommendation alone',
] as const;

const COMMUNITY_AREAS = [
  {
    icon: BookOpen,
    title: 'Build outcomes',
    body: 'Record what was made, what changed, and what the real yield was.',
  },
  {
    icon: MessageCircle,
    title: 'Practical notes',
    body: 'Share finishing, tooling, and process lessons without presenting opinion as certification.',
  },
  {
    icon: Users,
    title: 'Consented demand',
    body: 'Connect registered needs with capable workshops while keeping business identity under owner control.',
  },
] as const;

export default function LandingPage() {
  const scenarios = sampleScenarios();
  const examples = EXAMPLE_TEMPLATE_IDS.map((id) => getTemplate(id)).filter(
    (template): template is NonNullable<ReturnType<typeof getTemplate>> => template !== null,
  );

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section id="top" className="warm-orbit relative isolate overflow-hidden border-b border-line">
        <div className="playful-dots absolute inset-y-0 right-0 hidden w-1/2 opacity-60 lg:block" />
        <Container width="wide" className="relative py-16 sm:py-24 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkle className="size-3.5" aria-hidden />
                Circular manufacturing intelligence
              </div>

              <h1 className="max-w-3xl text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.06em] text-ink sm:text-[4rem] lg:text-[5.1rem]">
                Turn leftovers into{' '}
                <span className="relative whitespace-nowrap text-primary">
                  real value.
                  <span className="absolute -bottom-1 left-1 right-1 h-1 rounded-full bg-accent/70" />
                </span>
              </h1>

              <p className="max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted sm:text-base">
                Photograph leftover material and get products you can actually build, cost and sell —
                every number backed by evidence.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/sign-in">
                  <Button size="lg" iconRight={<ArrowRight className="size-4" aria-hidden />}>
                    Open App
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline">
                    Explore how it works
                  </Button>
                </a>
              </div>

              <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
                {[
                  { label: 'Dimensions', value: 'Measured, never guessed' },
                  { label: 'Feasibility', value: 'Deterministic gates' },
                  { label: 'Money', value: 'Integer minor units' },
                ].map((entry) => (
                  <div key={entry.label}>
                    <dt className="micro-label">{entry.label}</dt>
                    <dd className="mt-1 text-[0.8125rem] leading-snug text-ink">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative min-h-[31rem] sm:min-h-[35rem]">
              <div className="absolute inset-x-0 top-0 rounded-[2rem] border border-line bg-accent-wash p-4 shadow-raised sm:left-4 sm:right-0 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Reka found a fit</span>
                    <p className="mt-1 text-sm font-semibold text-ink">Plywood offcuts → useful products</p>
                  </div>
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent-ink">Sample data</span>
                </div>
                <div className="panel relative z-10 ml-0 w-[72%] overflow-hidden rounded-2xl sm:w-[68%]">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-3">
                    <span className="micro-label">Live evaluation</span>
                    <span className="size-2 rounded-full bg-success" aria-label="Engine ready" />
                </div>
                <div className="space-y-3 p-4">
                  {scenarios[0]?.opportunities.slice(0, 3).map((opportunity) => (
                    <div
                      key={opportunity.templateId}
                      className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium text-ink">
                          {opportunity.productName}
                        </p>
                        <p className="micro-label mt-0.5">
                          {opportunity.maxUnits > 0
                            ? `${opportunity.maxUnits} units · ${opportunity.wastePercent}% waste`
                            : 'Rejected'}
                        </p>
                      </div>
                      <span className={opportunity.gatesPassed ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-danger'}>
                        {opportunity.gatesPassed ? 'Viable' : 'Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
                <Image
                  src={rekaMascot}
                  alt="Reka, resaikel's bowerbird mascot, holding a package made from reclaimed material"
                  priority
                  sizes="(max-width: 640px) 240px, 340px"
                  className="absolute -bottom-24 -right-10 z-20 h-auto w-[15rem] drop-shadow-[0_18px_20px_rgb(43_23_18/0.16)] sm:-bottom-28 sm:-right-8 sm:w-[21rem]"
                />
              </div>
              <p className="absolute bottom-2 left-2 z-30 max-w-[13rem] text-xs font-semibold leading-relaxed text-ink-muted">
                Measured, not imagined — every number keeps its evidence.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <div className="overflow-hidden border-b border-primary-hover bg-primary py-3 text-white">
        <p className="whitespace-nowrap text-center text-xs font-semibold tracking-[0.12em]">
          MATERIALS IN · FEASIBILITY CHECKED · COSTS EXPLAINED · BUYERS MATCHED · NO FIGURES INVENTED
        </p>
      </div>

      {/* ------------------------------------------------------- how it works */}
      <section id="how-it-works" className="border-b border-line bg-white py-16 sm:py-24">
        <Container width="wide" className="space-y-8">
          <SectionRule index="01" label="The workflow, step by step" />
          <SectionHeading
            eyebrow="Interactive preview"
            title="From a photograph to a ranked opportunity"
            description="Walk four steps. Yield, cost, price and buyers are computed live by the real engine on a fixed sample."
          />
          <WorkflowPreview scenarios={scenarios} locale={serverConfig.defaults.locale} />
        </Container>
      </section>

      {/* ------------------------------------------------ five intelligences */}
      <section id="intelligence" className="border-b border-line bg-accent-wash py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="02" label="Five kinds of intelligence" />
          <SectionHeading
            eyebrow="How it works"
            title="Five questions, answered in order"
            description="Each layer uses only what the one above it proved — so a good sentence is never mistaken for a result."
          />

          <ol className="grid gap-x-8 gap-y-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(20rem, 100%), 1fr))' }}>
            {INTELLIGENCES.map((entry) => {
              const Icon = entry.icon;
              return (
                <li key={entry.index} className="space-y-3 border-t border-line pt-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="micro-label tnum">{entry.index}</span>
                  </div>
                  <h3 className="text-[0.9375rem] font-medium text-ink">{entry.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{entry.body}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* -------------------------------------------------- the pipeline */}
      <section className="border-b border-line bg-white py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="03" label="Eight steps, and the order is the point" />
          <SectionHeading
            eyebrow="The pipeline"
            title="Eight steps, and each builds on the last"
            description="No step may use what an earlier one didn’t establish."
          />
          <ol className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
            {PIPELINE.map((entry) => (
              <li key={entry.step} className="flex gap-5 border-t border-line pt-5">
                <span className="micro-label tnum shrink-0 pt-0.5">{entry.step}</span>
                <div className="space-y-2">
                  <h3 className="text-[0.9375rem] font-medium text-ink">{entry.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{entry.body}</p>
                  <p className="micro-label text-accent-ink">{entry.aside}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ------------------------------------------------------- reference */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="04" label="Reference" />
          <SectionHeading
            eyebrow="Reference"
            title="The five verdicts, and the five sort modes"
            description="Every state a candidate can be in, and every way to order them."
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

      {/* -------------------------------------------------------- examples */}
      <section id="examples" className="border-b border-line bg-primary-wash py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="05" label="Material to product" />
          <SectionHeading
            eyebrow="Examples"
            title="What the catalogue actually contains"
            description="Six validated specs, each with a real parts list, tooling and labour time. If it can’t be built, it isn’t here."
          />

          <ul className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(17rem, 100%), 1fr))' }}>
            {examples.map((template) => (
              <li key={template.id} className="panel overflow-hidden">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-surface-sunken">
                  <Image
                    src={`/catalogue/${template.id}.jpg`}
                    alt={template.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 17rem"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="text-[0.9375rem] font-medium text-ink">{template.name}</h3>
                  <p className="line-clamp-3 text-xs leading-relaxed text-ink-muted">
                    {template.description}
                  </p>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
                    <div>
                      <dt className="micro-label">Complexity</dt>
                      <dd className="text-xs capitalize text-ink">{template.complexity}</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Labour</dt>
                      <dd className="tnum font-mono text-xs text-ink">
                        {template.labourMinutesPerUnit} min
                      </dd>
                    </div>
                    <div>
                      <dt className="micro-label">Tools</dt>
                      <dd className="tnum font-mono text-xs text-ink">
                        {template.requiredTools.length}
                      </dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------------------------------------------------- impact */}
      <section id="impact" className="border-b border-line bg-white py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="06" label="Count what was reused" />
          <SectionHeading
            eyebrow="Impact"
            title="Count what was reused. Leave the rest unclaimed."
            description="We measure real material movement from stock to finished work — not assumptions dressed up as statistics."
          />
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h3 className="text-[0.9375rem] font-medium text-ink">What can be measured</h3>
              <ul className="mt-5 space-y-4">
                {IMPACT_MEASURED.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-t border-line pt-4 text-sm text-ink-muted"
                  >
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[0.9375rem] font-medium text-ink">What remains unknown</h3>
              <ul className="mt-5 space-y-4">
                {IMPACT_NOT_CLAIMED.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-t border-line pt-4 text-sm text-ink-muted"
                  >
                    <MinusCircle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------- sustainability */}
      <section className="border-b border-line bg-accent-wash py-16 sm:py-24">
        <Container width="wide" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionHeading
            eyebrow="Sustainability"
            title="Measured, not asserted"
            description="Easy to fabricate, hard to verify. So we report only what we can count."
          />

          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Material registered', value: 'Counted' },
                { label: 'Allocated to a project', value: 'Counted' },
                { label: 'Actually reused', value: 'From your records' },
                { label: 'Carbon saved', value: 'Not claimed' },
              ].map((entry) => (
                <div key={entry.label} className="border-t border-line pt-3">
                  <dt className="micro-label">{entry.label}</dt>
                  <dd className="mt-1 text-sm text-ink">{entry.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm leading-relaxed text-ink-muted">
              Waste reduction is arithmetic on your own records — area in, area used, the difference.
              No carbon figure, because there’s no methodology behind one yet.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ limits */}
      <section className="border-b border-line bg-white py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="07" label="Where it refuses to guess" />
          <SectionHeading
            eyebrow="What it will not do"
            title="The limits are part of the product"
            description="Trust comes from being explicit about the edge of what we know."
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: 'It will not certify anything',
                body: 'No load, fire, food-contact or packaging-standard rating. A 2D layout is not a safety proof.',
              },
              {
                title: 'It will not invent a price',
                body: 'Prices trace to labelled evidence. Listings are asking prices, never proof of demand.',
              },
              {
                title: 'It will not name a buyer',
                body: 'Always a buyer category, or a consented request. No brand is shown as a buyer unless it registered.',
              },
            ].map((entry) => (
              <div key={entry.title} className="space-y-2 border-t border-line pt-5">
                <h3 className="text-[0.9375rem] font-medium text-ink">{entry.title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{entry.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------- community */}
      <section id="community" className="border-b border-line bg-accent-wash py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="08" label="Knowledge that survives the first build" />
          <SectionHeading
            eyebrow="Community"
            title="Useful knowledge should survive the first build."
            description="Built around production outcomes, practical lessons and consent — not a feed of unverified AI ideas."
          />
          <div className="grid gap-8 lg:grid-cols-3">
            {COMMUNITY_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.title} className="border-t border-line pt-5">
                  <Icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-4 text-[0.9375rem] font-medium text-ink">{area.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{area.body}</p>
                </article>
              );
            })}
          </div>
          <p className="border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
            Publishing isn’t live yet. Start a material record and keep your production evidence
            ready.
          </p>
        </Container>
      </section>

      {/* ----------------------------------------------------------- about */}
      <section id="about" className="border-b border-line bg-white py-16 sm:py-24">
        <Container width="wide" className="space-y-10">
          <SectionRule index="09" label="Why resaikel exists" />
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <SectionHeading
              eyebrow="About"
              title="A practical bridge between leftover material and useful work."
              description="Making small-scale circular manufacturing easier to reason about — visual assistance, deterministic engineering, and commercial checks."
            />
            <Image
              src={rekaMascot}
              alt="Reka, the resaikel bowerbird mascot"
              className="mx-auto h-auto w-56"
            />
          </div>
          <div className="grid gap-12 border-t border-line pt-8 lg:grid-cols-2">
            <div>
              <h3 className="text-[0.9375rem] font-medium text-ink">Why this product exists</h3>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                Reuse advice is often inspiring but incomplete. An idea is only useful when the
                material fits, the process exists, the cost is visible, and uncertainty is stated.
              </p>
            </div>
            <div>
              <h3 className="text-[0.9375rem] font-medium text-ink">How AI is used</h3>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                AI describes photos, picks from the catalogue, and explains results. People and
                deterministic engines own every fact that touches production or money.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ final */}
      <section className="bg-primary py-16 text-white sm:py-24">
        <Container width="default" className="text-center">
          <div className="space-y-6 [&_.micro-label]:text-white/70 [&_h2]:text-white [&_p]:text-white/80">
            <SectionHeading
              align="center"
              eyebrow="Start here"
              title="Photograph the offcuts. See what they are worth."
              description="Upload a material, confirm what it is, and get products you can build, cost and sell — every assumption visible."
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/sign-in">
                <Button variant="accent" size="lg" iconRight={<ArrowRight className="size-4" aria-hidden />}>
                  Open App
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="border-white/50 bg-white text-ink hover:bg-white/90">
                  Explore how it works
                </Button>
              </a>
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-ink-faint">
              <Sparkle className="size-3.5" aria-hidden />
              Free to try. No payments, no transactions.
            </p>
          </div>
        </Container>
      </section>

      {/* honesty strip */}
      <section className="border-t border-line bg-surface py-8">
        <Container width="wide">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-ink-faint" aria-hidden />
              <span className="micro-label">Everything on this page</span>
            </div>
            <p className="max-w-3xl text-xs leading-relaxed text-ink-muted">
              Every example, price and feasibility result here runs through the real engines on a
              fixed sample. No customer logos, testimonials or market stats — we have none to cite.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
