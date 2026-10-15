import {
  ArrowRight,
  Boxes,
  Compass,
  Factory,
  Package,
  Ruler,
  Sparkle,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { WorkflowPreview } from '@/components/marketing/workflow-preview';
import { GridBackdrop, SectionRule } from '@/components/signature/annotations';
import { ProductSilhouette } from '@/components/signature/product-silhouette';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container, SectionHeading } from '@/components/ui/layout';
import { getTemplate } from '@/domain/catalog';
import { sampleScenarios } from '@/domain/demo/sample-scenarios';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: 'resaikel — turn waste into worth',
  description:
    'resaikel transforms leftover materials into manufacturable products and real business ' +
    'opportunities through AI-powered material, production and market intelligence.',
};

const INTELLIGENCES = [
  {
    index: '01',
    title: 'Material intelligence',
    icon: Boxes,
    body: 'Describe what is actually there from photographs — category, condition, contamination, restrictions — and refuse to guess the dimensions.',
  },
  {
    index: '02',
    title: 'Product intelligence',
    icon: Ruler,
    body: 'Propose products from a curated catalogue of validated specifications, parameterised inside declared bounds. Never invented geometry.',
  },
  {
    index: '03',
    title: 'Manufacturing intelligence',
    icon: Factory,
    body: 'Check every gate deterministically: material family, sheet size, thickness, contamination, tooling. Then nest real parts with real kerf.',
  },
  {
    index: '04',
    title: 'Market intelligence',
    icon: Package,
    body: 'Report price only from labelled evidence, with its freshness and quality stated. No evidence means “Insufficient Market Data”, not a guess.',
  },
  {
    index: '05',
    title: 'Buyer intelligence',
    icon: Users,
    body: 'Name categories of buyer that could want it, and surface registered demand that its owner consented to share. Never a brand that has not asked.',
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

export default function LandingPage() {
  const scenarios = sampleScenarios();
  const examples = EXAMPLE_TEMPLATE_IDS.map((id) => getTemplate(id)).filter(
    (template): template is NonNullable<ReturnType<typeof getTemplate>> => template !== null,
  );

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <GridBackdrop variant="major" className="opacity-70" />
        <Container width="wide" className="relative py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-7">
              <div className="micro-label">Circular manufacturing intelligence</div>

              <h1 className="text-[2.25rem] font-medium leading-[1.08] tracking-[-0.03em] text-ink sm:text-[3rem]">
                Unused materials.
                <br />
                Untapped opportunities.
              </h1>

              <p className="max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted sm:text-base">
                resaikel transforms leftover materials into manufacturable products and real business
                opportunities through AI-powered material, production and market intelligence.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/sign-in">
                  <Button size="lg" iconRight={<ArrowRight className="size-4" aria-hidden />}>
                    Discover material potential
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline">
                    Explore how it works
                  </Button>
                </Link>
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

            <div className="space-y-4">
              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-3">
                  <span className="micro-label">Evaluation · scenario A</span>
                  <Badge tone="accent" technical>
                    Sample data
                  </Badge>
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
                      <Badge
                        tone={opportunity.gatesPassed ? 'success' : 'danger'}
                        technical
                      >
                        {opportunity.gatesPassed ? 'viable' : 'rejected'}
                      </Badge>
                    </div>
                  ))}
                  <p className="text-xs leading-relaxed text-ink-faint">
                    Computed live on this page by the same engines the application runs. The input is a
                    sample scenario; the arithmetic is real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------- workflow */}
      <section id="workflow" className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-8">
          <SectionRule index="01" label="The workflow, step by step" />
          <SectionHeading
            eyebrow="Interactive preview"
            title="From a photograph to a ranked opportunity"
            description="Walk the four steps. Every figure — the nesting yield, the cost lines, the price band, the buyer match — is computed by the real engine for a fixed sample input."
          />
          <WorkflowPreview scenarios={scenarios} locale={serverConfig.defaults.locale} />
        </Container>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section id="intelligence" className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="02" label="Five kinds of intelligence" />
          <SectionHeading
            eyebrow="How it works"
            title="Five questions, answered in order"
            description="Each layer can only use what the layer above it established. That ordering is what stops a plausible sentence from being mistaken for an engineering result."
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

      {/* -------------------------------------------------------- examples */}
      <section id="examples" className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="03" label="Material to product" />
          <SectionHeading
            eyebrow="Examples"
            title="What the catalogue actually contains"
            description="Six of the validated specifications currently in the catalogue, each with a real parts list, tooling requirement and labour time. Additions must be genuinely buildable, not imagined."
          />

          <ul className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(17rem, 100%), 1fr))' }}>
            {examples.map((template) => (
              <li key={template.id} className="panel overflow-hidden">
                <ProductSilhouette
                  category={template.category}
                  partCount={template.parts.length}
                  className="border-b border-line"
                />
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

      {/* ------------------------------------------------------ intelligence */}
      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="space-y-10">
          <SectionRule index="04" label="Where it refuses to guess" />
          <SectionHeading
            eyebrow="What it will not do"
            title="The limits are part of the product"
            description="A platform that turns waste into business decisions earns trust by being explicit about the edge of what it knows."
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: 'It will not certify anything',
                body: 'No load rating, no fire rating, no food-contact safety, no packaging standard compliance. Feasibility is a conservative 2D nest, stated as such on every result — a successful layout does not prove structural safety.',
              },
              {
                title: 'It will not invent a price',
                body: 'Prices come from labelled evidence with its source type and freshness shown. Listing prices are labelled as asking prices and never presented as proof of demand. No evidence means Insufficient Market Data.',
              },
              {
                title: 'It will not name a buyer',
                body: 'Buyer output is always a category of buyer, or a registered request whose owner consented to be matched. No brand is ever presented as an active purchaser without their own registration.',
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

      {/* ----------------------------------------------------- sustainability */}
      <section className="border-b border-line py-16 sm:py-20">
        <Container width="wide" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionHeading
            eyebrow="Sustainability"
            title="Measured, not asserted"
            description="Sustainability claims are easy to fabricate and hard to verify, so resaikel reports only what it can count."
          />

          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Material registered', value: 'Counted' },
                { label: 'Allocated to a project', value: 'Counted' },
                { label: 'Actually reused', value: 'From your records' },
                { label: 'Carbon saved', value: 'Not claimed' },
              ].map((entry) => (
                <div key={entry.label} className="rounded-md border border-line bg-surface px-4 py-3">
                  <dt className="micro-label">{entry.label}</dt>
                  <dd className="mt-1 text-sm text-ink">{entry.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm leading-relaxed text-ink-muted">
              Waste reduction is reported as arithmetic on your own records: sheet area registered,
              sheet area consumed by a completed project, and the difference. No carbon figure is
              shown, because there is no documented methodology behind one yet — and an undocumented
              number is worse than no number.
            </p>
            <p className="text-xs leading-relaxed text-ink-faint">
              The same principle applies to the AI: resaikel does not claim a proprietary trained
              model. Outcome data is recorded so that recommendation quality can be evaluated later,
              and that is all that is claimed.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ final */}
      <section className="py-16 sm:py-24">
        <Container width="default" className="text-center">
          <div className="space-y-6">
            <SectionHeading
              align="center"
              eyebrow="Start here"
              title="Photograph the offcuts. See what they are worth."
              description="Upload a material, confirm what it actually is, and get products that can be built, costed and sold — with every assumption visible and every unknown left unknown."
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/sign-in">
                <Button size="lg" iconRight={<ArrowRight className="size-4" aria-hidden />}>
                  Discover material potential
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline">
                  Explore how it works
                </Button>
              </Link>
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-ink-faint">
              <Sparkle className="size-3.5" aria-hidden />
              Free to try. No payment processing, and no transaction is created.
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
              Every example, price and feasibility result on this site is generated from a fixed
              sample scenario through the real engines. No customer logos, testimonials or market
              statistics are shown, because resaikel has no customers to cite and no market data of
              its own to quote.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
