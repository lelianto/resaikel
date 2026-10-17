import { ArrowRight, BookOpen, MessageCircle, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Container, PageHeader } from '@/components/ui/layout';

export const metadata: Metadata = {
  title: 'Community',
  description: 'The future knowledge-sharing space for practical circular manufacturing.',
};

const COMMUNITY_AREAS = [
  { icon: BookOpen, title: 'Build outcomes', body: 'Record what was made, what changed, and what the real yield was.' },
  { icon: MessageCircle, title: 'Practical notes', body: 'Share finishing, tooling, and process lessons without presenting opinion as certification.' },
  { icon: Users, title: 'Consented demand', body: 'Connect registered needs with capable workshops while keeping business identity under owner control.' },
] as const;

export default function CommunityPage() {
  return (
    <>
      <section className="border-b border-line bg-accent-wash py-16 sm:py-24">
        <Container width="wide">
          <Reveal>
            <PageHeader
              eyebrow="Community"
              title="Useful knowledge should survive the first build."
              description="The community layer is being designed around production outcomes, practical lessons, and consent. It is not a feed of unverified AI ideas."
            />
          </Reveal>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container width="wide">
          <div className="grid gap-8 lg:grid-cols-3">
            {COMMUNITY_AREAS.map((area, index) => {
              const Icon = area.icon;
              return (
                <Reveal
                  as="article"
                  key={area.title}
                  delay={index * 90}
                  className="border-t border-line pt-5"
                >
                  <Icon className="size-6 text-primary" aria-hidden />
                  <h2 className="mt-4 text-xl font-semibold text-ink">{area.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{area.body}</p>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">Community publishing is not active in this release. Start by creating a material record and keep your production evidence ready.</p>
            <Link href="/materials/new">
              <Button iconRight={<ArrowRight className="size-4" aria-hidden />}>Scan material</Button>
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
