# AI pipeline

## Principles

1. **The model proposes; deterministic code decides.** No number a user sees is
   produced by a language model.
2. **Everything is validated.** No model response reaches Firestore or the UI
   without passing a Zod schema.
3. **The prompt is a contract, not a suggestion.** The hard rules are stated as
   rules and enforced in code afterwards.
4. **Untrusted input stays untrusted.** Images and user text are data. The system
   instruction says so explicitly, and nothing from a model is ever used to
   authorise, fetch a URL, or execute anything.

## Model selection

Model ids come from the environment and are never hardcoded, so an outdated model
can be swapped without a code change:

| Variable | Default | Used for |
|---|---|---|
| `GEMINI_MATERIAL_MODEL` | `gemini-3.1-flash-lite` | Photograph analysis — the cost-efficient multimodal call |
| `GEMINI_DISCOVERY_MODEL` | `gemini-3.1-flash-lite` | Catalogue-bound product candidate selection |
| `GEMINI_EXPLANATION_MODEL` | `gemini-3.1-flash-lite` | Prose explanations and buyer segmentation |

Verify availability and pricing against current Google documentation before
changing these. No image generation is used: it would add cost and latency for
decoration, and this product does not ship decorative renders.

## The five functions

| Function | Input | Output contract | Notes |
|---|---|---|---|
| `analyzeMaterial` | Photographs + owner context | `MaterialAnalysisSchema` | Never asked for dimensions |
| `generateProductCandidates` | Material facts + template subset | `ProductCandidateSetSchema` | May only select from the supplied subset |
| `explainFeasibility` | Engine results | `FeasibilityExplanationSchema` | Prose only; forbidden from recalculating |
| `suggestBuyerSegments` | Product + evidence | `BuyerSegmentSuggestionSchema` | Segment ids from a closed list |
| `summarizeBusinessOpportunity` | Engine results | `OpportunitySummarySchema` | Prose only |

## Material analysis: what the model is forbidden to say

`MaterialAnalysisSchema` has **no field** for thickness, weight, density,
composition, grade, mechanical strength, load capacity, fire rating or
certification. Not because the model is asked nicely, but because there is nowhere
to put the answer.

Anything it cannot see must go into `missingInformation`, and the prompt says
dimensions always belong there. The confidence contract is per field, never a
single score, because one global confidence number is exactly the kind of thing
that gets mistaken for a safety clearance.

### Defence in depth

Because prose can still contain a measurement, `findUnsupportedClaims` scans the
free-text fields for measurement-like patterns:

```
1200 mm   ·   5 kg   ·   18 MPa   ·   350 gsm
```

A match is never stored as a fact. It is listed in
`unsupportedClaims`, discarded, and shown to the user as a disregarded claim — so
the user can see that resaikel noticed and refused it.

## Discovery: the catalogue boundary

The model is handed a closed subset of templates with their parameter bounds:

```
- templateId: cardboard-shipping-box-small
  name: Small shipping box
  parameters:
      length: 100-400 (step 5, default 200)
      width: 80-300 (step 5, default 150)
      height: 60-250 (step 5, default 100)
  targetSegments: electronics_brands, refurbishers, ...
```

It may select a template and propose parameter values inside those bounds. It may
not invent geometry, tooling, labour times or consumables, because it is not asked
for any of them — they are read from the template afterwards.

`resolveCandidateSet` is the enforcement point. It drops, with a stated reason:

| Problem | Outcome |
|---|---|
| A template id that was not offered | Dropped |
| A parameter outside its declared range | Clamped, with the issue recorded |
| A claim of certification, load rating or compliance | Dropped |
| A concept carrying geometry | Parameters discarded; it stays a concept |

If everything is dropped, the pipeline raises `AI_UNSAFE_RECOMMENDATION` rather
than evaluating nothing and returning an empty result set.

A candidate for which **no validated template exists** is labelled
**"Concept Only — Manufacturing Validation Required"** everywhere it appears, is
never nested, never costed, and its feasibility is `not_evaluated`.

## Structured output and self-repair

No `responseSchema` is passed to the SDK. Instead the JSON contract is written
into the prompt, and the response is parsed and validated. On a violation the
specific Zod issues are fed back and the model is asked once more:

```
Your previous response was rejected by schema validation.
Fix exactly these problems and return the corrected JSON object only:
- fieldConfidence: Required
- candidates.0.templateId: A template candidate must name a templateId.
```

Transport failures and validation failures are handled separately: the client
retries transport errors with jittered exponential backoff, while validation
failures get one corrective retry with the issues named.

The schemas deliberately avoid Zod `.default()`. A default would make a field
optional on the way in *and* split the inferred input and output types, which
weakens the contract the model is held to for no benefit.

## Caching

Analysis is billed per call, so identical input must never be analysed twice. The
key is a SHA-256 of:

- the sorted SHA-256 digest of every photograph
- the prompt contract version (`AI_PROMPT_VERSION`)
- the model id
- the normalised text context

Sorting the digests means reordering photographs does not invalidate the cache;
including the prompt version and model means changing either correctly does. A
completed job with a matching hash is served instead of starting new work, and the
UI reports that a previous analysis was reused.

## Cost control

- Photographs are compressed client-side (1600 px ceiling, quality 0.82) and
  capped at four per analysis
- Candidates are capped by `AI_MAX_CANDIDATES`
- Explanations are generated for the **top three** ranked candidates only, so five
  candidates cost three prose calls, not five
- Hard timeouts on every call (`AI_TIMEOUT_MS`), with retries bounded by
  `AI_MAX_ATTEMPTS`
- A daily per-user allowance (`AI_DAILY_QUOTA_PER_USER`) enforced by a Firestore
  counter
- Token usage is recorded on the job document for telemetry, and no secret is ever
  written

## Failure handling

| Failure | Behaviour |
|---|---|
| Invalid JSON | Parsed defensively (code fences stripped), then retried once, then `AI_INVALID_OUTPUT` |
| Missing fields | Schema violation, fed back for repair, then `AI_INVALID_OUTPUT` |
| Unsupported material | The model returns `unknown`; the engine returns `not_evaluated` rather than guessing |
| Low confidence | Surfaced per field; confirmation is still required |
| Timeout | `AI_TIMEOUT`, retried with backoff |
| Rate limit | `AI_RATE_LIMITED`, retried; surfaced as `RATE_LIMITED` |
| Model unavailable | `AI_UNAVAILABLE`; the UI degrades to manual entry |
| Unsafe recommendation | `AI_UNSAFE_RECOMMENDATION` with the offending claims listed |
| No API key | The deterministic mock adapter runs instead; the UI labels every affected result |

**The flow never hard-blocks on AI.** With no key, or with Gemini down, a user can
still create a material, confirm its properties by hand, and run discovery —
because discovery's grounding comes from the catalogue and the engines, not from
the model.

## The mock adapter

`AI_MODE=mock`, or `auto` with no key, uses `src/ai/mock.ts`. It is not a fixed
string: it derives its answers from its input.

- The category comes from a keyword scan of the owner's description, and returns
  `unknown` when nothing is recognisable, rather than guessing
- Contamination and damage are projected from the description into reuse
  restrictions
- Candidate selection runs the real fit check, and falls back to a concept when no
  template fits
- It obeys the same contract, including never inventing a measurement

This keeps the UI, the flows and the tests fully exercised at zero cost, and it is
always labelled: `mock: true` on the job, a note in the result, and a visible
"offline mock adapter — no model was called" marker on screen.
