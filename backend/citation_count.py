"""Fetch real citation statistics from Semantic Scholar, with OpenAlex fallback."""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime


def _http_get_json(url: str, timeout: int = 12) -> dict | list | None:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ResearchMindAI/1.0 (portfolio; mailto:researchmind@local)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def _normalize_title(title: str) -> str:
    return " ".join((title or "").lower().split())


def _titles_match(a: str, b: str) -> bool:
    na, nb = _normalize_title(a), _normalize_title(b)
    if not na or not nb:
        return False
    return na == nb or na in nb or nb in na


def _build_stats(citation_count: int, year: int | None, influential: int | None) -> dict:
    current_year = datetime.utcnow().year
    publication_year = year if isinstance(year, int) and year > 1900 else None
    years_since = max(current_year - publication_year, 0) if publication_year else None
    divisor = max(years_since, 1) if years_since is not None else 1
    avg = round(citation_count / divisor, 2) if citation_count is not None else None

    if avg is None:
        impact = None
    elif avg >= 50:
        impact = "High"
    elif avg >= 10:
        impact = "Moderate"
    elif avg > 0:
        impact = "Emerging"
    else:
        impact = "Limited"

    highly_influential = None
    if influential is not None:
        highly_influential = "Yes" if influential > 0 else "No"

    return {
        "total_citations": citation_count,
        "average_citations_per_year": avg,
        "publication_year": publication_year,
        "years_since_publication": years_since,
        "estimated_research_impact": impact,
        "highly_influential": highly_influential,
        "source": None,
        "available": True,
    }


def _from_semantic_scholar(title: str) -> dict | None:
    query = urllib.parse.quote(title)
    url = (
        "https://api.semanticscholar.org/graph/v1/paper/search"
        f"?query={query}&limit=5&fields=title,year,citationCount,influentialCitationCount"
    )
    data = _http_get_json(url)
    if not data or not isinstance(data, dict):
        return None

    papers = data.get("data") or []
    match = None
    for item in papers:
        if _titles_match(title, item.get("title") or ""):
            match = item
            break
    if match is None and papers:
        # Prefer exact-ish match only; avoid wrong papers when titles diverge strongly
        first = papers[0]
        if _titles_match(title, first.get("title") or ""):
            match = first

    if match is None:
        return None

    citation_count = match.get("citationCount")
    if citation_count is None:
        return None

    stats = _build_stats(
        int(citation_count),
        match.get("year"),
        match.get("influentialCitationCount"),
    )
    stats["source"] = "Semantic Scholar"
    return stats


def _from_openalex(title: str) -> dict | None:
    query = urllib.parse.quote(title)
    url = (
        "https://api.openalex.org/works"
        f"?search={query}&per_page=5"
    )
    data = _http_get_json(url)
    if not data or not isinstance(data, dict):
        return None

    results = data.get("results") or []
    match = None
    for item in results:
        if _titles_match(title, item.get("title") or ""):
            match = item
            break

    if match is None:
        return None

    citation_count = match.get("cited_by_count")
    if citation_count is None:
        return None

    stats = _build_stats(int(citation_count), match.get("publication_year"), None)
    stats["highly_influential"] = "Unavailable"
    stats["source"] = "OpenAlex"
    return stats


def get_citation_count(title: str, published: str | None = None) -> dict:
    """
    Return real citation statistics for a paper title.
    Never fabricates citation counts.
    """
    clean_title = (title or "").strip()
    if not clean_title:
        return {"available": False, "message": "Citation data unavailable."}

    stats = _from_semantic_scholar(clean_title)
    if stats is None:
        stats = _from_openalex(clean_title)

    if stats is None:
        # If external APIs fail, still surface publication year from local metadata when valid
        year = None
        if published:
            try:
                year = int(str(published)[:4])
            except ValueError:
                year = None
        return {
            "available": False,
            "message": "Citation data unavailable.",
            "publication_year": year,
        }

    return stats
