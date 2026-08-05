"""
Auto-tagging service using RAKE (Rapid Automatic Keyword Extraction).
Extracts the most relevant keywords/phrases from document text.
"""
import re
from typing import List


def extract_tags(text: str, max_tags: int = 8) -> List[str]:
    """
    Extract top keywords from text to use as tags.
    Uses RAKE-NLTK. Falls back to simple frequency-based extraction.
    """
    if not text or not text.strip():
        return []

    try:
        from rake_nltk import Rake
        r = Rake(min_length=1, max_length=3)
        r.extract_keywords_from_text(text[:3000])
        phrases = r.get_ranked_phrases()[:max_tags]
        # Clean and deduplicate
        tags = []
        seen = set()
        for phrase in phrases:
            clean = _clean_tag(phrase)
            if clean and clean.lower() not in seen and len(clean) < 40:
                tags.append(clean)
                seen.add(clean.lower())
        return tags[:max_tags]
    except Exception:
        return _fallback_tags(text, max_tags)


def _clean_tag(tag: str) -> str:
    """Clean and normalize a tag string."""
    tag = re.sub(r'[^a-zA-Z0-9\s\-]', '', tag).strip()
    tag = re.sub(r'\s+', ' ', tag)
    return tag.lower()


def _fallback_tags(text: str, max_tags: int = 8) -> List[str]:
    """Simple word frequency fallback for tag extraction."""
    import re
    from collections import Counter

    # Common English stop words
    stop_words = {
        "the", "a", "an", "is", "it", "in", "on", "at", "to", "for",
        "of", "and", "or", "but", "with", "by", "from", "this", "that",
        "are", "was", "were", "be", "been", "has", "have", "had", "do",
        "does", "did", "will", "would", "could", "should", "may", "might",
        "shall", "can", "not", "no", "nor", "so", "yet", "both", "either",
        "also", "as", "if", "then", "than", "when", "where", "which",
        "who", "whom", "how", "all", "each", "every", "more", "most",
        "other", "some", "such", "only", "its", "their", "our", "your",
        "my", "his", "her", "we", "you", "they", "he", "she", "i", "me",
    }

    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    filtered = [w for w in words if w not in stop_words]
    most_common = Counter(filtered).most_common(max_tags * 2)
    tags = [word for word, _ in most_common if len(word) < 30]
    return tags[:max_tags]
