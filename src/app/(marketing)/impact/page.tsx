import { ArrowRight, CheckCircle2, MinusCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Container, PageHeader } from '@/components/ui/layout';

export const metadata: Metadata = {
  title: 'Impact',
  description: 'How resaikel measures material reuse without inventing sustainability claims.',
};

const MEASURED = [
  'Material records and confirmed quantities',
  'Sheet area allocated to evaluated products',
  'Material consumed by completed production records',
  'Cutting waste estimated by the deterministic nesting engine',
] as const;

const NOT_CLAIMED = [
  'Carbon emissions avoided',
  'Landfill diversion without a completed reuse record',
  'Environmental certification or regulatory compliance',
  'Impact derived only from an AI recommendation',
] as const;

export default function ImpactPage() {
  return (
    <>
      <section className="border-b border-line bg-primary-wash py-16 sm:py-24">
        <Container width="wide">
          <Reveal>
            <PageHeader
              eyebrow="Impact"
              title="Count what was reused. Leave the rest unclaimed."
              description="resaikel measures practical material movement from registered stock to completed work. It does not turn assumptions into sustainability statistics."
            />
          </Reveal>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container width="wide" className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-semibold text-ink">What can be measured</h2>
            <ul className="mt-6 space-y-4">
              {MEASURED.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line pt-4 text-sm text-ink-muted">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="text-2xl font-semibold text-ink">What remains unknown</h2>
            <ul className="mt-6 space-y-4">
              {NOT_CLAIMED.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line pt-4 text-sm text-ink-muted">
                  <MinusCircle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>

      <section className="bg-primary py-14 text-white">
        <Container width="wide" className="flex flex-wrap items-center justify-between gap-6">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">Start with one material record.</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/75">Confirmed inputs are the beginning of every useful impact measurement.</p>
          </Reveal>
          <Reveal delay={120} className="flex flex-wrap gap-3">
            <Link href="/sign-in?next=/circularity">
              <Button variant="accent" iconRight={<ArrowRight className="size-4" aria-hidden />}>View your impact</Button>
            </Link>
            <Link href="/sign-in?next=/materials/new">
              <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">Scan material</Button>
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
