# Miithii Voice Economics Draft

Last updated: May 11, 2026

This is a working launch model, not accounting advice. It uses `INR 85 = USD 1` for quick planning and should be refreshed before production pricing goes live.

## Pricing Sources

- Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Sarvam pricing: https://www.sarvam.ai/pricing
- Supabase pricing: https://supabase.com/pricing
- Vercel pricing: https://vercel.com/pricing
- Clerk pricing: https://clerk.com/pricing
- Razorpay pricing: https://razorpay.com/pricing/

## Unit Cost Baseline

Miithii should sell generated audio minutes, not message counts. A message limit does not match the real cost curve because the expensive part is generated audio duration.

### Gemini TTS

Google lists Gemini 3.1 Flash TTS Preview at:

- Input: USD 1.00 per 1M tokens
- Output: USD 20.00 per 1M tokens
- Batch output: USD 10.00 per 1M tokens
- Audio output accounting: 25 audio tokens per second

Instant Gemini TTS cost:

| Item | Formula | Cost |
| --- | ---: | ---: |
| 1 minute audio tokens | `60s * 25` | `1,500` tokens |
| Gemini output cost | `1,500 / 1,000,000 * USD 20` | `USD 0.03` |
| INR cost at 85/USD | `0.03 * 85` | `INR 2.55/min` |
| Input prompt/text estimate | 500-1,500 tokens | `INR 0.04-0.13/generation` |

Use `INR 3.25-4.00/min` as the practical Gemini internal cost after prompt tokens, retries, failed generations, feedback credits, and small storage overhead.

Batch Gemini TTS can drop the output cost to about `INR 1.28/min`, but only use that for long jobs where the user accepts waiting.

### Sarvam

Sarvam lists:

| Sarvam API | Price | Miithii Interpretation |
| --- | ---: | --- |
| Language Identification | `INR 3.5 / 10K chars` | Cheap enough to run on a trimmed sample |
| Bulbul v2 TTS | `INR 15 / 10K chars` | About `INR 0.75-1.35/min` at 500-900 chars/min |
| Bulbul v3 TTS | `INR 30 / 10K chars` | About `INR 1.50-2.70/min` at 500-900 chars/min |
| Translate | `INR 20 / 10K chars` | Use only when required |
| Transliterate | `INR 20 / 10K chars` | Use only when required |

For language detection, cap the sample to the first `1,000` characters. That makes worst-case detection cost around `INR 0.35` per generation, usually much less than audio synthesis.

## Infrastructure Cost

Storage and bandwidth are not the main cost if we store compressed audio.

| Layer | Launch Choice | Expected Cost |
| --- | --- | ---: |
| Auth | Clerk dev/free first | `INR 0` early, Pro about `USD 25/mo` if needed |
| App hosting | Vercel Hobby first, Pro when serious | `USD 0-20/mo` |
| Database + object storage | Supabase Free first, Pro when usage grows | `USD 0-25/mo` |
| Payment gateway | Razorpay | Model `2.36%` domestic effective fee after GST |
| Audio storage | Compressed MP3/AAC, not raw PCM | Usually tiny vs TTS cost |

Raw PCM/WAV can be around 2.8 MB per minute. Compressed MP3/AAC is often around 0.5-1 MB per minute. Store the compressed export format, keep metadata in DB, and avoid long-term raw audio unless there is a clear reason.

## Recommended Launch Pricing

`INR 199/mo` for 20 minutes is financially safe, but it can feel too expensive for first-time users in India/Northeast India before Miithii has trust. The launch ladder should reduce the first payment while still protecting cost.

Start with UPI-friendly credit packs first. Add subscriptions after repeat usage is proven.

Use generated minute credits. Re-downloads from history are free. Regenerations cost credits again unless we deliberately refund a verified failure.

Internal conservative cost floor: `INR 4/min`.

### Launch Credit Packs

| Pack | Price | Included Minutes | User Price/Min | Full-Use Variable Cost | Gateway Fee Estimate | Full-Use Gross Profit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Try | `INR 19` | `2` | `INR 9.50` | `INR 8` | `INR 1` | `INR 10` |
| Mini | `INR 49` | `6` | `INR 8.17` | `INR 24` | `INR 2` | `INR 23` |
| Creator | `INR 99` | `14` | `INR 7.07` | `INR 56` | `INR 3` | `INR 40` |

The `INR 19` pack is not meant to be the business. It is a trust builder for users who want to test one real downloadable voice export without committing.

Do not sell unlimited. Do not sell very cheap long-form plans until provider routing, batch generation, abuse controls, and quality refund rules are working.

### Later Subscription Plans

Only add subscriptions once users show repeat generation behavior. Subscription minutes can be slightly better than credit packs, but not so cheap that full-use customers become unprofitable.

| Plan | Price | Monthly Minutes | Notes |
| --- | ---: | ---: | --- |
| Light | `INR 99/mo` | `16` | Entry subscription for students/local creators |
| Creator | `INR 249/mo` | `45` | Main paid plan after trust exists |
| Pro | `INR 499/mo` | `95` | Only safe if routing/batch lowers average cost below `INR 4/min` |

Expire top-up credits after 6-12 months. Subscription credits reset monthly.

## Free Trial

Give signed-in users a tiny but real test:

- `3` lifetime generated minutes
- Max `1` minute per generation during trial
- No public anonymous generation in production
- Watermark optional, but not required if trial minutes are small

## Cost Controls To Build

1. Credit ledger: monthly grant, used minutes, top-up balance, expiry.
2. Per-generation cost metadata: provider, chars, seconds, prompt version, retry count, detection cost, output cost estimate.
3. Provider router: Gemini instant for short interactive jobs, Gemini batch for long jobs, Sarvam when quality and language fit are better or cheaper.
4. Quality feedback: refund credits only for verified failures or strict rules, not unlimited retries.
5. Download history: store generated audio and metadata, but charge only for generation, not re-downloads.
6. Abuse limits: per-user daily cap, max text length by plan, signed-in generation only.

## Break-Even Snapshot

If the paid stack becomes Vercel Pro + Supabase Pro + Clerk Pro, fixed SaaS cost is roughly `USD 70/mo`, or about `INR 6,000/mo` at this planning exchange rate.

At the `INR 99` Creator credit pack:

- 100 users paying `INR 99` = `INR 9,900` revenue
- Payment gateway at 2.36% = about `INR 234`
- Full use at 14 minutes/user = `1,400` minutes
- TTS cost at `INR 4/min` = `INR 5,600`
- Fixed SaaS estimate = `INR 6,000`
- Rough profit before tax/salary = negative `INR 1,934` once the paid SaaS stack is active

That is why the low-price launch should stay on free/low infra as long as possible. The packs are profitable on variable cost, but fixed SaaS cost needs either more users, higher packs, or lower provider cost.

This means the low-cost India pricing only works if:

1. Fixed SaaS costs stay low until paid volume grows.
2. Sarvam/provider routing lowers average generation cost.
3. Long-form heavy users move into higher plans or manual Studio pricing.
4. Failed generations and free retries are controlled.

## Launch Decision

Start with only three visible credit packs: `INR 19`, `INR 49`, and `INR 99`.

Keep subscriptions and larger packs behind the scenes until repeat usage is proven. Keep Studio/manual long-form hidden until generation is stable.

The product promise should be: generate high-quality regional voice exports, download them, and keep a history. The pricing promise should be transparent minute credits, not unlimited magic.
