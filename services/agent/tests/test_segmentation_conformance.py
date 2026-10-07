"""Python sentence splitting must match the single shared conformance corpus."""

from __future__ import annotations

from miithii_agent.policy import _read_document, load_segmentation_rules
from miithii_agent.sentences import split_sentences, split_sentences_with


def test_every_shared_fixture_matches_python_splitter() -> None:
    fixtures = _read_document()["segmentation"]["conformance"]
    rules = load_segmentation_rules()
    for fixture in fixtures:
        assert split_sentences(fixture["text"]) == fixture["sentences"]
        assert split_sentences_with(fixture["text"], rules) == fixture["sentences"]


def test_ellipsis_and_abbreviation_hazards_are_shared() -> None:
    assert split_sentences("এটা… দুটা।") == ["এটা…", "দুটা।"]
    assert split_sentences("St. Road।") == ["St. Road।"]
