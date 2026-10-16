import type { Metadata } from 'next';
import Image from 'next/image';

import rekaMascot from '../../../../assets/reka-bowerbird-mascot.png';
import { Container, PageHeader } from '@/components/ui/layout';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why resaikel exists and how it approaches circular manufacturing intelligence.',
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-line bg-[#eefaf8] py-16 sm:py-24">
        <Container width="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <PageHeader
            eyebrow="About"
            title="A practical bridge between leftover material and useful work."
            description="resaikel exists to make small-scale circular manufacturing easier to reason about. It combines visual assistance with deterministic engineering and commercial checks."
          />
          <Image src={rekaMascot} alt="Reka, the resaikel bowerbird mascot" className="mx-auto h-auto w-64" priority />
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container width="wide" className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Why this product exists</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">Material reuse advice is often inspirational but incomplete. A product idea is only useful when the material fits, the required process is available, the cost is visible, and uncertainty is stated clearly.</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-ink">How AI is used</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">AI helps describe photographs, select from a curated catalogue, and explain computed results. Human confirmation and deterministic engines remain responsible for the facts that affect production and money.</p>
          </div>
        </Container>
      </section>
    </>
  );
}
