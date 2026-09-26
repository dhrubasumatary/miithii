# MIITHII: Bodo/Boro language research notes

Prepared 15 September 2026. These notes support the `packages/language-core` Bodo (`brx`) profile. They are a research layer for prompt design and evaluation, not a claim that MIITHII has native-speaker-level Bodo competence. The profile should keep a smaller set of well-supported structural rules instead of growing a guessed grammar.

## Naming and standard written form

Both **Bodo** and **Boro** are widely used names for the language. The product currently uses `Bodo` as its English label, while a large body of linguistic work uses `Boro`. They are not separate languages. For the native-script label, current Bodo-medium sources from CIIL/NCERT, Bharatavani and Assam education materials render the name as `Ã Â¤Â¬Ã Â¤Â°Ã¢â‚¬â„¢`/`Ã Â¤Â¬Ã Â¤Â°ÃŠÂ¼`. Some Hindi-facing Government of India navigation instead renders the Hindi name as `Ã Â¤Â¬Ã Â¤Â¡Ã Â¤Â¼Ã Â¥â€¹`. Unicode specifies U+02BC MODIFIER LETTER APOSTROPHE (`ÃŠÂ¼`) for the Bodo tone mark, so MIITHII stores the native label as `Ã Â¤Â¬Ã Â¤Â°ÃŠÂ¼` and keeps `Bodo` as the English product label.

Modern standard writing uses Devanagari. The 2024 CIIL-NCERT Bodo Primer is a current official literacy source, and the Bodo Sahitya Sabha documents the adoption of Devanagari in 1975. The primer and Bodo Sahitya Sabha material also show native Boro spellings such as `Ã Â¤Â¬Ã Â¤Â°Ã¢â‚¬â„¢` in titles and organization names. Hindi spellings of the language name are therefore not a reliable guide to Bodo orthography.

Unicode documents a Bodo-specific use of U+02BC MODIFIER LETTER APOSTROPHE as a tone mark called **gojau kamaa**. MIITHII must accept this mark inside otherwise valid Devanagari Bodo text. A generic punctuation normalizer could silently damage valid spelling.

Primary references:

- CIIL & NCERT, *Bodo Primer* (2024): https://ciil.org/primers/Bodo_Primer.pdf
- Bodo Sahitya Sabha, history/script material: https://bodosahityasabha.org/geneva_convention.html
- Unicode Core Specification, Devanagari chapter: https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-12/

## Clause structure and discourse

Bodo is verb-final with basic SOV order, but surface order is not rigid enough to justify mechanically rearranging every sentence. Krishna Boro's work describes substantial clause chaining, with non-final clauses before a finite verb at the end of the chain. Natural MIITHII output should preserve this discourse option instead of forcing English-style independent clauses everywhere.

Case marking is not a simple suffix table. A 2018 Bodo/Sanzari comparison gives standard Bodo accusative `-kÃŠÂ°Ã‰Â¯u` and Sanzari `-kÃŠÂ°Ã‰Â¯`; Krishna Boro's 2016 description writes the standard form as `-kÃŠÂ°ou`. That difference is best treated as transcription/source variation rather than silently normalizing one source into the other. Overt case marking is also conditioned by discourse and semantic factors such as definiteness, identifiability and animacy; object pronouns are more consistently marked. This is a strong reason to prevent the model from attaching a case suffix to every noun phrase just because a prompt listed the suffix once.

Reference:

- Krishna Boro, *The Za constructions: Middle-like constructions in Boro* (2016): https://www.researchgate.net/publication/296633252_The_Za_constructions_Middle-like_constructions_in_Boro

## Pronouns and honorificity

The core reference forms used in the prompt are supported across descriptive work: first singular `aÃ…â€¹`, first plural `zÃ‰Â¯Ã…â€¹`, second singular `nÃ‰Â¯Ã…â€¹`, third singular `bi`, with `-sÃ‰Â¯r` plural forms for second/third non-honorific pronouns. `-thaÃ…â€¹` marks honorific second/third-person forms, with `-mÃ‰Â¯n` reported in honorific plurals. Third-person `bi` does not encode the Hindi-style masculine/feminine opposition; the model must not invent gender agreement from the fact that both languages use Devanagari.

References:

- Bridul Basumatary, *Personal Pronoun in Bodo* (2019): https://old.rrjournals.com/wp-content/uploads/2019/07/348-350_RRIJM190407076.pdf
- *Formation of Kinship Terms in Boro*, honorific-pronoun discussion: https://www.davidpublisher.org/Public/uploads/Contribute/552f7c150ce8b.pdf

## Tense, aspect and modality

This is an area where the prompt must remain conservative. One descriptive analysis treats ordinary present tense as unmarked, while comparative Boro-Garo work describes a neutral-tense suffix with Bodo reflexes such as `-Ã‰Â¯/-a/-Ã‰Â¨`; other descriptive work labels forms such as `-Ã‰Â¯` or `-dÃ‰Â¯Ã…â€¹` as present in particular constructions. These analyses are not identical. MIITHII should therefore avoid the categorical rule "present tense is always unmarked."

Better-supported anchors are:

- past `-mÃ‰Â¯n` in descriptive analyses;
- future `-gÃ‰Â¯n`, while `-gÃ‰Â¯n` can also participate in dubitative/modal constructions;
- habitual `-Ã‰Â¯`, with `-jÃ‰Â¯` described as an allomorph in phonological environments;
- progressive `-gasinÃ‰Â¯` normally occurring with an auxiliary such as `dÃ‰Â¯Ã…â€¹/doÃ…â€¹`;
- perfective `-dÃ‰Â¯Ã…â€¹` and perfect `-bai` in multiple linguistic examples;
- verb + aspect + tense ordering is well attested when both categories surface.

These are diagnostic anchors, not instructions to manufacture inflections. When unsure, MIITHII should use a simpler construction rather than combine morphemes by analogy.

References:

- Daimalu Brahma, *Inflectional Processes of Tense and Aspect in Bodo* (2014): https://www.languageinindia.com/jan2014/tenseaspectbodo.pdf
- Scott DeLancey et al., *Proto-Boro-Garo verbal elements*, in *North East Indian Linguistics 5*: https://www.researchgate.net/publication/263852168_North_East_Indian_Linguistics_Volume_5
- Aleendra Brahma, *Grammatical Moods in Bodo* (2013): https://languageinindia.com/jan2013/aleendramoodsfinal.pdf
- Mahanta, Das & Gope, *On the Phonetics and Phonology of Focus Marking in Boro* (2016): https://journals.linguisticsociety.org/proceedings/index.php/amphonology/article/download/3668/3444/4820

## Numeral classifiers

Bodo has a real classifier system. Basumatary's 2015 paper explicitly states that classifiers precede numerals and gives `sa-se`/`sa-nÃ‰Â¯i` for people, `ma-se`/`ma-nÃ‰Â¯i` for animals and related beings, and `mÃ‰Â¯n-se`/`mÃ‰Â¯n-nÃ‰Â¯i` as a broad classifier used especially with inanimate nouns. Asha Rani Brahma's 2016 comparative study independently gives the same classifier-before-numeral pattern for `sa-` and `ma-`. This is strong enough to use as a live structural rule: MIITHII should not generate numeral + classifier order such as `nÃ‰Â¯i ma` merely because English places the number first.

The product implication is to teach both ordering and semantic choice while still forbidding guesses outside the verified anchors. The language has many more classifiers than these three, so a tiny list must not become a fake closed inventory.

### Prompt-evaluation note, 15 September 2026

A paired Gemini 2.5 Flash probe exposed a real prompt regression before the classifier rule was tightened: an earlier structured prompt produced number + classifier sequences for the human and animal test cases. After replacing the vague description with the source-backed classifier-before-numeral rule and the attested `sa-`/`ma-` anchors, the next structured run produced classifier-before-number sequences (`Ã Â¤Â¸Ã Â¤Â¾ Ã Â¤Â¥Ã Â¤Â¾Ã Â¤Â®` and `Ã Â¤Â®Ã Â¤Â¾ Ã Â¤Â¨Ã Â¥Ë†`) in those two cases. This is evidence that the prompt can influence the intended structural feature. It is **not** evidence that either whole generated sentence is fluent Bodo; lexical choice, morphology and naturalness still require blinded fluent-speaker review.

References:

- Guddu Prasad Basumatary, *Numeral Classifiers in Bodo* (2015): https://d1i1jdw69xsqx0.cloudfront.net/digitalhimalaya/collections/journals/nepling/pdf/Nep_Ling_30.pdf
- Asha Rani Brahma, comparative classifier study (2016): https://www.languageinindia.com/april2016/asharanibodoclassifiers.pdf
- Aleendra Brahma, *Nominal categorial prefixes in the Boro Part of the Sal languages* (2022): https://repositories.cdlib.org/uc/item/1vz927sb

## Questions, imperatives and negation

Bodo questions should not be generated through an English `do/does/did + subject + verb` template. Narzary & Baro's 2024 study describes yes/no questions using question particles as well as intonation, and lists `na` among the productive particles. Independent intonational work on Boro also documents `na` between alternatives. The exact inventory and distribution of all question particles needs stronger native-speaker evaluation, so the runtime prompt keeps only the structural lesson and the cross-checked `na` anchor rather than memorizing the paper's whole particle list.

Imperatives likewise should not be reduced to one obligatory suffix. Aleendra Brahma's verb-subject incorporation study describes imperative verbs in bare form and also an imperative particle transcribed `-dÃ‰Â¯`. The product rule is therefore permissive: recognize both strategies and do not attach `-dÃ‰Â¯` mechanically to every command.

Negation is especially unsafe to compress into one rule. Comparative and dialect studies describe prefixal negatives, suffixal negatives and negative copulas, with forms differing by construction and variety. `da-` is repeatedly documented as a prohibitive/negative prefix, while the Southern variety study gives additional suffixal negatives and the negative copula `gija`. Those Southern forms must remain labelled as Southern-dialect evidence rather than being promoted wholesale to universal Standard Bodo. The live prompt therefore warns against an invented one-suffix negative paradigm and against importing Hindi or Assamese negation.

References:

- Udangshri Narzary & Bhoumik Chandra Baro, *Interrogative sentence of Bodo: A study* (2024): https://www.bpasjournals.com/library-science/index.php/journal/article/download/3007/4076/8826
- Kalyan Das & Shakuntala Mahanta, *Intonational phonology of Boro* (2019): https://www.glossa-journal.org/article/id/5210/
- Aleendra Brahma, *Verb-Subject Incorporation in Bodo*: https://selindia.org/wp-content/uploads/2022/12/7_Verb-Subject-Incorporation-in-Bodo.pdf
- Pratima Brahma, *Negation in Bodo and Dimasa: A brief study* (2021)
- Mihir Kumar Brahma, *Negation in the Southern Dialect of Bodo* (2014): https://www.languageinindia.com/

## Tone and spoken output

Modern phonological work on standard Boro strongly supports a two-way lexical tone contrast, High and Low, with the syllable as the tone-bearing unit and important interactions between tone and morphology. This must not be generalized to every regional variety: Mahela & Sinha's study of Sanzari Boro, based on ten native speakers, reports three distinct tones in monosyllabic words. Tone is lexical/grammatical information, not expressive decoration. For TTS, a Bodo-specialized voice/provider should carry pronunciation and tone; the LLM should not insert ad-hoc IPA or ASCII tone notation into ordinary replies.

References:

- Kalyan Das & Shakuntala Mahanta, *Distribution of lexical tones in Boro* (2018): https://escholarship.org/uc/item/8fn4380d
- Das & Mahanta, *Intonational phonology of Boro* (2019): https://www.glossa-journal.org/article/id/5282/
- Ratul Mahela & Sweta Sinha, *A phonological investigation of Sanzari Boro* (2022): https://www.jbe-platform.com/content/journals/10.1075/sl.20010.mah

## Contact, borrowing and conversational register

Bodo is used in a multilingual environment. Assamese contact is well documented, and Bodo-English code-switching has been observed in both rural and urban conversation. A borrowed English or Assamese word is therefore not proof that the sentence has stopped being Bodo. The useful check is whether Bodo morphosyntax and discourse remain coherent around the borrowing.

Garton, Dale, Roy & Basumatary's 2022 study is directly relevant to Miithii's display-script decision. Their Boro interviewees reported Roman and Devanagari use online, with convenience and typing speed as major reasons for choosing Roman. Educational-medium background also influenced script choice: one English-medium speaker described speaking Boro but writing it in Roman because Devanagari spelling was less familiar. Interviewees described conversations that could remain in Devanagari between Boro-medium writers or switch toward Roman, and they associated more formal public/news contexts with heavier Devanagari use. The study also reports substantial spelling variation in informal Boro online writing and dialect as one reason for that variation. This is a small qualitative study, so it supports flexibility rather than a claim that all Boro speakers prefer Roman.

The same interviews make a second product distinction that matters for Voice: **standard script is not the same thing as formal register**. Interviewees described Standard Boro and informal/conversational Boro as differing especially in word choice, and one speaker reported that formal written Boro could be difficult to understand despite being able to read the script because it differed from everyday spoken wording. Miithii Voice should therefore use conversational spoken Boro phrasing while encoding the internal TTS source in standard Devanagari orthography. A formal Standard Boro register should be selected because the task or user calls for it, not merely because the TTS source is written in Devanagari.

The CoRSAL/UNT Boro Language Resource provides a second useful evidence layer: it is a community-built archive of modern Boro collected by Boro linguists/community members, with 249 items including 171 sound recordings, 41 texts and 37 videos. Its materials cover multiple generations and include conversations, greetings, life histories and community events. Many catalogued Boro text titles are represented in Latin transcription, while newer narrative items also preserve recordings plus transcription/translation. This makes the collection useful for building a reviewed conversational evaluation set without inventing example Boro sentences ourselves.

A 2026 study of Bodo students in Assamese-medium higher education also reports domain shift and weak orthographic stability in digital spaces for its small urban sample. This warns against treating one spelling or one highly formal register as the only authentic conversational Bodo. It does not justify inventing slang; native-speaker evaluation remains necessary.

References:

- Rachel Garton, Merrion Dale, L. Somi Roy & Prafulla Basumatary, *Endangered Languages in the Digital Public Sphere: A case study of the writing systems of Boro and Manipuri* (2022): https://www.fluxus-editions.fr/gla10-gart.pdf
- UNT/CoRSAL, *Boro Language Resource*: https://digital.library.unt.edu/explore/collections/BLR/
- Jupitara Boro, *Bodo-English Code Switching: A Sociolinguistic Perspective* (2018): https://languageinindia.com/march2018/jupitarocodeswitchingbodo1.pdf
- Sanjay Boro, *Phonological Features of Assamese in Boro* (2025): https://ejournals.ncert.gov.in/index.php/ET/article/view/3720
- Dihingia & Kalita, *Intergenerational Language Transmission and Domain Shift among Bodo Students in Assamese Higher Education* (2026): https://gauhati.ac.in/publications/intergenerational-language-transmission-and-domain-shift-among-bodo-students-in-assamese-higher-education-16900/

## What MIITHII should validate next

The next quality gate is a native-speaker evaluation set, separated by task rather than one vague "fluency" score. At minimum, test ordinary conversation, emotional/supportive conversation, question-answering, tense/aspect contrasts, case marking, classifier phrases, honorific reference, clause chaining, Assamese/English code-switching, Devanagari tone-mark handling, and speech output through the `Gwrbw` TTS voice.

Each item should record whether the failure is semantic, grammatical, orthographic, dialect/register-related, or contamination from Assamese/Hindi/English. Add prompt rules only for repeated, reviewed failure patterns. Do not grow a guessed dictionary inside the system prompt.

## Independent Bodo validation track

Bodo evaluation is deliberately separate from Assamese evaluation. The two languages may share product infrastructure and a neutral MIITHII companion policy, but Assamese grammar, examples, spelling conventions, and reviewer judgments are not evidence for Bodo. Bodo prompt changes must be justified by Bodo/Boro sources or repeated fluent-speaker-reviewed failures.

The current Bodo evaluator therefore compares two conditions that share the same neutral MIITHII personality and decoding settings:

- **minimal Bodo**: only the Bodo reply-language/script contract plus a short anti-contamination instruction;
- **structured Bodo**: the same neutral companion policy plus the researched Bodo profile.

This avoids the earlier confound where the baseline had a different personality prompt from the structured condition. Evaluation items are also split into **everyday** scenarios and **diagnostic** scenarios. Everyday items test whether MIITHII can actually converse; diagnostic items pressure a specific researched construction such as questions, negation, honorific reference, or numeral classifiers. Script validation is automated, but grammar, lexical choice, register and naturalness are not assigned an automatic fluency score.

### Bodo-only paired probe, 15 September 2026

With Gemini 2.5 Flash at temperature 0.2, the separated evaluator reproduced several intended structural effects:

- human counting: the minimal condition produced a number+noun form, while the structured condition produced `sa-tham ...`; the latter has the independently documented classifier-before-numeral shape with `sa-` for people;
- animal counting: the structured condition produced `ma-nai ...`, matching the documented classifier-before-numeral shape with `ma-` for animals;
- alternative question: the structured condition placed `na` between the tea/coffee alternatives, consistent with independent intonational work describing Boro `na` between alternatives;
- honorific prompt: the structured condition used the `nong-thang` honorific second-person anchor represented in the descriptive literature.

These are **feature-level observations, not fluent-sentence approvals**. For example, the animal-classifier sentence may still contain a poor noun choice or unnatural surrounding morphology even if `ma-nai` is structurally appropriate. Likewise, a question can place `na` correctly while still sound unnatural overall. Only fluent-speaker review can establish those broader judgments.

A separate ordinary-greeting probe also exposed a runtime/evaluation confound: with `max_tokens=768`, one minimal-condition response spent 734 completion tokens on model reasoning and ended with `finish_reason=length`. Research runs now use a larger completion budget when the goal is linguistic comparison so token starvation is not mistaken for a language-policy effect. Production Voice should be evaluated separately under its actual budget.

### Production Voice delivery probe, 15 September 2026

A direct production-provider probe exposed two delivery constraints that must stay separate from language quality. With Gemini 2.5 Flash and a Bodo-only Devanagari instruction, an 800-token completion budget returned only 61 visible Bodo characters with `finish_reason=length`, ending mid-word. Bodhan `Gwrbw` then synthesized that already-truncated text faithfully. Increasing the model completion budget to 4096 produced a complete 197-character Bodo reply with `finish_reason=stop`; the resulting Gwrbw WAV was about 17.83 seconds and a Bodhan STT round-trip reached the end of the utterance.

The production implication is counter-intuitive but important: Bodo Voice needs a **larger model-generation budget and a shorter final speech budget**. The current contract therefore uses 4096 generation tokens for Bodo while limiting the spoken reply to 180 Unicode characters, preferring one short complete sentence and using a second only when necessary. Assamese keeps its separate 512-token / 360-character contract. A later canary produced 30.55 seconds of Gwrbw audio from only 213 characters, demonstrating that character count is not a stable duration proxy and that the earlier 240-character ceiling still sat too close to Bodhan's documented roughly-30-second guidance. The 180-character ceiling is therefore a conservative delivery guard, not a claim that every 180-character utterance has identical duration. Runtime checks must still reject `finish_reason=length`, overlong visible replies, and wrong-script output before TTS.

### CoRSAL reuse boundary

The UNT Boro Language Resource is appropriate as an authentic research and evaluation reference: it is a community collection of modern Boro with audio, text and video, including interviews, greetings, life histories and community speech. Public availability does **not** by itself grant unrestricted training-data reuse. UNT states that collection materials are made available for research, teaching and private study, while copyright, donor restrictions, privacy/publicity rights or item-specific licensing may constrain reproduction. Before copying any transcript/audio into a training corpus or shipping derived examples, inspect the individual item's `Citations, Rights, Re-Use` metadata and obtain permission where required. For now, MIITHII should use CoRSAL to design evaluation categories and manually review conversational patterns rather than bulk-ingesting the archive.
