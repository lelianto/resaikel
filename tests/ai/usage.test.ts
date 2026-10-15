import { describe, expect, it } from 'vitest';

import { addAiUsage } from '@/ai/client';

describe('addAiUsage', () => {
  it('adds token usage across retries and schema-repair attempts', () => {
    expect(
      addAiUsage(
        { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
        { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
      ),
    ).toEqual({ inputTokens: 180, outputTokens: 45, totalTokens: 225 });
  });

  it('keeps an unavailable metric unknown instead of reporting a false zero', () => {
    expect(
      addAiUsage(
        { inputTokens: null, outputTokens: 10, totalTokens: null },
        { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
      ),
    ).toEqual({ inputTokens: null, outputTokens: 15, totalTokens: null });
  });
});
