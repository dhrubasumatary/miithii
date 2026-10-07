"""Sentence segmentation for Assamese/Bodo, including streamed token boundaries."""

from __future__ import annotations

import asyncio

from miithii_agent.sentences import MiithiiSentenceTokenizer, split_sentences


def test_danda_ends_a_sentence() -> None:
    assert split_sentences("নমস্কাৰ। আপুনি কেমন আছে?") == ["নমস্কাৰ।", "আপুনি কেমন আছে?"]


def test_double_danda_ends_a_sentence() -> None:
    assert split_sentences("প্ৰথম বাক্য। দ্বিতীয় বাক্য॥") == ["প্ৰথম বাক্য।", "দ্বিতীয় বাক্য॥"]


def test_decimal_point_is_not_a_terminator() -> None:
    assert split_sentences("এটা 3.5 কিলোমিটাৰ দূৰ।") == ["এটা 3.5 কিলোমিটাৰ দূৰ।"]
    assert split_sentences("দুটা 3,5 কিলোমিটাৰ দূৰ।") == ["দুটা 3,5 কিলোমিটাৰ দূৰ।"]


def test_abbreviation_does_not_end_a_sentence() -> None:
    assert split_sentences("চাই আপুনি Mr. Sharma ৰ সৈতে যাব নেকি?") == [
        "চাই আপুনি Mr. Sharma ৰ সৈতে যাব নেকি?"
    ]


def test_url_is_not_split() -> None:
    assert split_sentences("example.com আৰু https://a.b/c চাই") == [
        "example.com আৰু https://a.b/c চাই"
    ]


def test_latin_code_switching() -> None:
    assert split_sentences("Hello there! How are you? Fine.") == [
        "Hello there!",
        "How are you?",
        "Fine.",
    ]


def test_closing_quote_stays_with_sentence() -> None:
    assert split_sentences('সে ক\'ও কৈছে "হয়।" তাৎৎ কপাল।') == [
        'সে ক\'ও কৈছে "হয়।"',
        "তাৎৎ কপাল।",
    ]


def test_trailing_text_without_terminator_is_kept() -> None:
    assert split_sentences("অসমীয়া আৰু বৰ্গমাই ভাষা") == ["অসমীয়া আৰু বৰ্গমাই ভাষা"]


def test_empty_and_whitespace() -> None:
    assert split_sentences("") == []
    assert split_sentences("   \n\t ") == []


def test_no_sentence_is_ever_empty() -> None:
    parts = split_sentences("।।। এটা।। পুনৰ।")
    assert all(part.strip() for part in parts)
    assert "".join(parts).replace(" ", "") == "।।।এটা।।পুনৰ।"


def test_concatenation_preserves_all_content() -> None:
    text = "প্ৰথম বাক্য। দ্বিতীয় বাক্য॥ তৃতীয় প্ৰশ্ন? হ্যাঁ।"
    joined = " ".join(split_sentences(text))
    assert joined == text


def test_tokenize_ignores_language_argument() -> None:
    tokenizer = MiithiiSentenceTokenizer()
    assert tokenizer.tokenize("এটা। দুটা।", language="brx") == ["এটা।", "দুটা।"]


def test_stream_reassembles_across_arbitrary_chunk_boundaries() -> None:
    """A danda split from its following text must not be committed as its own sentence."""

    async def run() -> list[str]:
        tokenizer = MiithiiSentenceTokenizer()
        stream = tokenizer.stream()
        received: list[str] = []

        async def consume() -> None:
            async for data in stream:
                received.append(data.token)

        task = asyncio.create_task(consume())
        text = "প্ৰথম বাক্য। দ্বিতীয় বাক্য॥ তৃতীয় কথা।"
        for index in range(0, len(text), 3):
            stream.push_text(text[index : index + 3])
        stream.end_input()
        await task
        return received

    received = asyncio.run(run())
    assert received == ["প্ৰথম বাক্য।", "দ্বিতীয় বাক্য॥", "তৃতীয় কথা।"]


def test_stream_yields_nothing_for_empty_input() -> None:
    async def run() -> list[str]:
        stream = MiithiiSentenceTokenizer().stream()
        received: list[str] = []

        async def consume() -> None:
            async for data in stream:
                received.append(data.token)

        task = asyncio.create_task(consume())
        stream.push_text("   ")
        stream.end_input()
        await task
        return received

    assert asyncio.run(run()) == []
