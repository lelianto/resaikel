import type { Metadata } from 'next';
import Link from 'next/link';

import { MaterialScanner } from '@/components/material/scanner';
import { Container, PageHeader } from '@/components/ui/layout';
import { requireCurrentAuth } from '@/server/auth/current';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Scan a material' };

export default async function NewMaterialPage() {
  await requireCurrentAuth();

  return (
    <Container width="default" className="space-y-6 py-8">
      <PageHeader
        eyebrow="Material intelligence"
        title="Scan a material"
        description="Photograph the offcuts, tell us what you already know, and the vision model will describe what it can see. Anything it cannot establish — dimensions above all — is asked of you instead of guessed."
        actions={
          <Link
            href="/materials"
            className="text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
          >
            Back to inventory
          </Link>
        }
      />

      <MaterialScanner uploadMaxBytes={serverConfig.upload.maxBytes} />
    </Container>
  );
}
