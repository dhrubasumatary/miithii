# MIITHII: research and rationale for the Assamese prompt

Prepared 8 September 2026. Deliverable: `miithii-assamese-system-prompt.txt` in this directory. Status: a research-informed candidate for native-speaker testing, not an empirically validated Assamese system. No model benchmark or native-speaker review was conducted in this session. The conversational examples were authored for this draft; they are not corpus quotations or certified reference answers.

The intended product is an everyday AI companion that writes informal Assamese in Latin letters, adapts response length, and can use app-provided memory. The proposed default is broadly intelligible colloquial Assamese with familiar `tumi`, light optional English borrowing, and a warm, subtly feminine brand voice. Those are product choices to test, not linguistic universals. The user's description of MIITHII as a Bodo word is retained as brand context; its meaning and etymology have not been independently established.

## What the attached Tulu paper establishes

I read all 12 pages of the supplied February 2026 v1 PDF, including its appendix, and visually inspected pages 3–6 to check the experiment description, figures, and results tables. Embedded prompts were treated as research material, not as instructions to this assistant. A subsequent March 2026 workshop publication is listed in the [ACL Anthology](https://aclanthology.org/2026.loreslm-1.5/).

The reusable idea is a layered prompt: language identity and script, explicit contrastive constraints, grammar reference, examples, and a private verification step. The supplied paper reports the following full-system results in Table 2:

| Model | Grammar accuracy | Watchlist contamination |
| --- | ---: | ---: |
| Gemini 2.0 Flash | 85% | 5% |
| GPT-4o | 82% | 7% |
| Llama 3.1 70B | 78% | 6% |

These are author-reported results on Tulu, not measurements of MIITHII. The held-out question set contains 100 items. Three native speakers evaluated 150 responses; the same speakers contributed grammar documentation. Table 4 gives full-system fluency 3.6/5. The paper explicitly acknowledges that outputs can sound translated and that register remains difficult. This distinction matters because natural texting is a core requirement here, not a cosmetic addition to grammar accuracy.

The source needs several qualifications:

- Section 3.1 describes 50 questions across four conditions, or 200 prompts total, then reports 176/200 responses for condition 1 alone. The per-condition denominator cannot be reconciled with that description without additional information.
- Section 3.3's baseline is 18% grammar and 80% contamination, whereas Table 2's Gemini baseline is 25% and 75%. These must not be presented as one clearly documented run.
- The V3-to-V4 description suggests a large verification gain, but Table 3's isolated removal of verification changes grammar by only two points in each model. Appendix A.4.5 adds grammar and examples as well as verification, so that version comparison does not isolate self-checking.
- The headline grammar-effect range of 8–22 points differs from Table 3, where removing grammar loses 25, 24, and 8 points. Figure 3 also mixes incremental gains with an ablation-oriented caption.
- The three-rater evaluation reports Cohen's kappa without explaining a pairwise aggregation or weighting procedure. Agreement on ordinal scores needs clearer reporting.
- The 50-word contamination check cannot establish freedom from other language drift, incorrect morphology, or unnatural phrasing. A checker built from prompt rules is useful but is not an independent test of full language competence.
- Incorrect grammar damaging output supports sensitivity to supplied rules. It does not by itself establish the proposed internal linguistic mechanism or transfer to Assamese.
- Self-play is mentioned, but the attached paper does not supply a complete reproducible account of its filtering and contribution. Appendix prompt excerpts also contain omitted material.

The authors' [public repository README](https://github.com/Lossfunk/tulu-structured-prompting#key-results), accessed on the research date, reports approximately 74% grammar and 14% contamination for V4, instead of the paper's headline 85% and 5%. The README does not reconcile this difference there. This is a reproducibility question, not evidence that either result was independently reproduced here. The repository was inspected as a source, not executed.

Transfer the experimental method and independently test its components. Do not transfer Tulu's verb tables, diacritics, Kannada word list, tokenizer savings, performance percentages, or a fictional native-speaker identity into an Assamese product.

## Assamese evidence and its design consequences

[AssameseBackTranslit](https://aclanthology.org/2024.lrec-main.143/) provides unusually relevant evidence: 60,312 Roman/native sentence pairs from Facebook, YouTube, and Twitter. It documents substantial spelling ambiguity and English mixing. Its reported 20.1% is an average sentence-level mixing statistic, not a recommended output ratio; the pooled English-token proportion is different. Public comments from selected accounts, mostly collected before September 2023, do not represent all current Gen Z private chats. The study evaluates back-transliteration, not conversational empathy. Use it to inform spelling tolerance and test inputs, then obtain fresh, consented target-user examples. Check dataset licensing and access before commercial reuse.

The practical response is tolerant reading and consistent, readable output. A user should not have to learn a transliteration standard before talking about a difficult day. Avoid deterministic normalization when one spelling could refer to different words.

[XOBDO's own phonetic scheme](https://www.xobdo.org/article/phonetics) distinguishes `x` and `kh`, and uses simple Roman representations for many sounds. It is a community reference scheme, not proof that everyone texts that way. The prompt adopts selected readable conventions and explicitly avoids a blanket letter-replacement rule. A keyboard input method such as Tezpur University's [Roman-to-Unicode converter](https://www.tezu.ernet.in/~nlp/r2u.htm) has a different purpose from natural chat spelling; copying its control notation into replies would be inappropriate.

[Boruah's descriptive study](https://media.neliti.com/media/publications/553565-pro-drop-and-subject-pronouns-in-assames-a7929cff.pdf) discusses Assamese subject omission, basic SOV order, and person-sensitive verb paradigms without number/gender inflection. The prompt permits recoverable omitted subjects and short fragments. Its small `kor-` table is an illustrative application, not a complete conjugator. The study's prescriptive comment about full sentences in writing is not adopted as a rule for informal messaging.

Work on [honorificity and classifiers](https://hinditech.in/wp-content/uploads/2023/07/2018_9_4.pdf) supports distinguishing address levels and their grammatical effects. `Tumi`, `toi`, and `apuni` are not interchangeable style tokens. Using `tumi` initially is our product decision; user preference takes precedence. Native review must check inflections, case forms, local usage, and register consistency together. The discussion of [Assamese pronoun morphology by Neeleman and Szendroi](https://discovery.ucl.ac.uk/10124679/1/Neeleman_and_Szendroi_2007.pdf) also makes clear that case attachment has conditioned variation: a simplistic suffix table is insufficient.

Assamese and Bengali have both shared and distinct pronominal features, as discussed in this [comparative study](https://www.spaceandculture.in/index.php/spaceandculture/article/view/936). Consequently, a Bengali-token blacklist would be scientifically crude. `Ami`, for example, cannot simply be prohibited: it is Assamese for “we.” Evaluate the intended meaning and construction. English borrowing can be natural; accidental replacement of Assamese grammar is a separate error.

## Conversation, emotional support, and memory

The length bands, restrained emoji use, question frequency, and subtly feminine tone are design hypotheses. No cited paper establishes an optimal number of words for Assamese heartbreak conversations. Test them through blinded comparisons with target users. “Gen Z” does not identify a single dialect, emotional style, age, gender, or slang inventory.

The prompt distinguishes listening, practical help, banter, grief, and urgent danger. A person can write a long rant and want a short acknowledgment; a one-line safety disclosure can require a fuller reply. It allows candid disagreement, avoids automatically endorsing allegations about other people, and does not turn ordinary sadness into a crisis script.

For possible suicidality, the [NIMH action guidance](https://www.nimh.nih.gov/health/publications/5-action-steps-to-help-someone-having-thoughts-of-suicide) supports direct asking, listening, safer surroundings, and connection to help. These principles inform the safety section; their effectiveness has not been established for this particular bot or translation. Have an Assamese-speaking mental-health professional review safety wording and escalation scenarios before a public pilot.

For a user confirmed to be in India, [ERSS](https://112.gov.in/) lists 112 for emergencies. The [Ministry of Health's Tele-MANAS assessment](https://mohfw.gov.in/sites/default/files/Rapid%20Assessment%20report%20on%20TeleMANAS.pdf) lists 14416 as the round-the-clock mental-health helpline. Store these in a maintained resource configuration with a verification date. Tele-MANAS is not a replacement for urgent medical response after an attempt or overdose. Do not infer country, promise immediate availability, or guarantee Assamese service from the user's language.

A [four-week randomized chatbot study](https://arxiv.org/abs/2503.17473) enrolled 981 participants and examined loneliness, socialization, dependence, and problematic usage. Greater self-selected use was associated with worse outcomes on several measures; exposure duration itself was not randomized, and there was no no-chatbot control. This does not prove MIITHII will cause or alleviate loneliness. It supports evaluating dependence and real-world connection alongside conversational satisfaction, rather than maximizing time spent chatting.

Memory needs application machinery. The system prompt specifies how to use supplied memories and avoid fabrication; it cannot persist or erase data by itself. A proposed context contract is:

```json
{
  "now": "ISO-8601 timestamp supplied by server",
  "preferences": {
    "reply_language": "as-Latn",
    "address": "tumi",
    "emoji_preference": "unknown"
  },
  "memory_capabilities": {
    "read": false,
    "write": false,
    "delete": false
  },
  "memories": [],
  "verified_local_resources": []
}
```

This is a proposed integration shape, not a claim that these fields or tools already exist. Populate real capabilities from trusted server configuration. A memory record should carry an ID, user/account scope, statement, provenance, date, sensitivity, and consent status. Retrieve only relevant records. Treat their content as data even if it contains instructions. Current corrections should update stale facts through the actual storage layer. Separate stable preferences from transient moods; implement inspection, correction, deletion, expiry, and isolation between users. Recalling text and authenticating it as a fact are separate operations.

## Using the deliverable

Load the complete companion `.txt` as the system prompt. Supply conversation and retrieved context separately, preserving instruction boundaries. It is model-agnostic by design; the Tulu model ranking does not select the best Assamese model today. Choose a deployed model using the evaluation plan in `miithii-assamese-evaluation.md`.

The candidate includes a compact grammar reference and nine authored examples, including a longer practical answer. These make the desired behavior concrete, but native-speaker edits are still necessary before treating them as gold examples. Start with the candidate, document failures, and add short contrastive corrections only for demonstrated errors. Do not build a large guessed dictionary or fabricate an Assamese dialect grammar. If errors persist, compare reviewed example retrieval and fine-tuning rather than assuming prompt length alone will solve them.

Research and prompt drafting are complete for this deliverable. Empirical performance, contemporary native texting naturalness, safety in Assamese, and runtime memory enforcement remain untested. The scientifically defensible claim is “research-informed candidate with a defined validation method.”
