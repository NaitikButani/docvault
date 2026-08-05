"""
Auto-summarization service using extractive summarization (sumy).
No GPU or API key required.
"""
from typing import Optional


def summarize_text(text: str, sentence_count: int = 4) -> str:
    """
    Generate an extractive summary of the given text.
    Uses sumy's LSA algorithm. Falls back to first N sentences if sumy is unavailable.
    """
    if not text or not text.strip():
        return ""

    text = text.strip()

    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lsa import LsaSummarizer

        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LsaSummarizer()
        summary_sentences = summarizer(parser.document, sentence_count)
        summary = " ".join(str(s) for s in summary_sentences)
        return summary if summary.strip() else _fallback_summary(text, sentence_count)
    except Exception:
        return _fallback_summary(text, sentence_count)


def _fallback_summary(text: str, sentence_count: int = 4) -> str:
    """Simple fallback: return first N sentences."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    selected = sentences[:sentence_count]
    return " ".join(selected) if selected else text[:500]
