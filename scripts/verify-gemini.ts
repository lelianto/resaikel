/**
 * Make one live, schema-validated Gemini call using a bundled photograph.
 *
 * Run with `npm run verify:gemini`. Environment values are loaded by Node from
 * `.env.local`; this script never reads or prints the API key itself.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { analyzeMaterial } from '../src/ai/service';
import { MaterialAnalysisSchema } from '../src/ai/schemas';
import { isAiLive, serverConfig } from '../src/lib/config';

async function main(): Promise<void> {
  if (!isAiLive() || serverConfig.ai.apiKey.length === 0) {
    throw new Error(
      'Live Gemini is not configured. Set AI_MODE=live and GEMINI_API_KEY in .env.local.',
    );
  }

  const photoPath = fileURLToPath(
    new URL('../tests/fixtures/photos/small-plywood-offcuts.jpg', import.meta.url),
  );
  const photo = readFileSync(photoPath);

  const outcome = await analyzeMaterial({
    title: 'Plywood offcuts from a cabinet job',
    origin: 'Cabinet workshop',
    userNotes: 'Stored indoors and ready for physical measurement.',
    knownMeasurements: null,
    photoCount: 1,
    images: [{ mimeType: 'image/jpeg', dataBase64: photo.toString('base64') }],
    categoryHint: 'plywood',
  });

  MaterialAnalysisSchema.parse(outcome.analysis);

  console.log(
    JSON.stringify(
      {
        ok: true,
        model: outcome.meta.model,
        category: outcome.analysis.category,
        condition: outcome.analysis.condition,
        attempts: outcome.meta.attempts,
        validationAttempts: outcome.meta.validationAttempts,
        usage: outcome.meta.usage,
      },
      null,
      2,
    ),
  );
}

void main();
