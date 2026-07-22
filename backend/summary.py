import os
import json

from dotenv import load_dotenv
from google import genai

# Load .env
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=API_KEY)


def generate_summary(title, abstract):

    prompt = f"""
You are an expert AI Research Assistant.

Analyze the following research paper.

Title:
{title}

Abstract:
{abstract}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "overview": "Write a concise 3-4 sentence overview explaining the purpose of the paper.",

  "key_contributions": [
    "Contribution 1",
    "Contribution 2",
    "Contribution 3"
  ],

  "methodology": [
    "Explain the techniques or algorithms used.",
    "Mention important models or architectures."
  ],

  "evaluation": [
    "Datasets used",
    "Performance metrics",
    "Experimental findings"
  ],

  "applications": [
    "Real-world application 1",
    "Real-world application 2"
  ],

  "limitations": [
    "Limitation 1",
    "Limitation 2"
  ],

  "future_work": [
    "Future work suggestion 1",
    "Future work suggestion 2"
  ],

  "difficulty": {{
      "level":"Beginner/Intermediate/Advanced",
      "reason":"Explain why."
  }}
}}

Return ONLY JSON.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    print("===== GEMINI RESPONSE =====")
    print(text)
    print("===========================")

    return json.loads(text)


def generate_chat_response(title, abstract, summary, history, question):
    history_text = "\n".join(
        [f"{item.get('role', 'assistant') if item.get('role') == 'assistant' else 'user'}: {item.get('message', '')}" for item in history]
    )

    prompt = f"""
You are ResearchMind AI, an expert research mentor.

Use the paper title, abstract, and AI summary below to answer the user's question clearly and directly.

Paper title:
{title}

Abstract:
{abstract}

AI summary:
{json.dumps(summary, indent=2)}

Conversation history:
{history_text}

Question:
{question}

Provide a helpful, research-focused answer in plain text.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    text = text.replace("```", "").strip()
    return text


def generate_comparison(paper_a, paper_b):
    """
    Generate a structured comparison between two papers.
    paper_a and paper_b should be dict-like with at least 'title' and 'abstract'.
    Returns parsed JSON-like object (dict) describing the comparison sections.
    """

    prompt = f"""
You are an expert AI Research Assistant. Compare the two research papers below.

Paper A Title:
{paper_a.get('title')}

Paper A Abstract:
{paper_a.get('abstract')}

Paper B Title:
{paper_b.get('title')}

Paper B Abstract:
{paper_b.get('abstract')}

Return ONLY valid JSON. Use exactly this structure:

{{
  "research_problem": {{
    "paper_a": "...",
    "paper_b": "..."
  }},

  "methodology": {{
    "paper_a": "...",
    "paper_b": "..."
  }},

  "model_architecture": {{
    "paper_a": "Mention models/architectures",
    "paper_b": "Mention models/architectures"
  }},

  "dataset": {{
    "paper_a": "...",
    "paper_b": "..."
  }},

  "results": {{
    "paper_a": "Metrics / key results",
    "paper_b": "Metrics / key results"
  }},

  "advantages": {{
    "paper_a": ["advantage 1", "advantage 2"],
    "paper_b": ["advantage 1", "advantage 2"]
  }},

  "limitations": {{
    "paper_a": ["limitation 1", "limitation 2"],
    "paper_b": ["limitation 1", "limitation 2"]
  }},

  "future_work": {{
    "paper_a": ["..."],
    "paper_b": ["..."]
  }},

  "final_opinion": "A concise recommendation comparing Paper A and Paper B"
}}

Return ONLY JSON.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except Exception:
        # If parsing fails, return a simple text-wrapped structure to avoid crashing
        return {"final_opinion": text}


def _strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    return cleaned


def _parse_json_response(text: str, fallback: dict) -> dict:
    cleaned = _strip_code_fences(text)
    try:
        return json.loads(cleaned)
    except Exception:
        return fallback


def translate_summary(summary: dict, language: str) -> dict:
    """
    Translate only the AI summary content into the target language.
    Preserve structure, headings keys, and bullet list shapes.
    """
    prompt = f"""
You are an expert academic translator.

Translate ONLY the research paper AI summary JSON below into {language}.

Rules:
- Keep the exact same JSON keys (overview, key_contributions, methodology, evaluation, applications, limitations, future_work, difficulty).
- Translate all human-readable string values.
- Preserve arrays as arrays and objects as objects.
- Do NOT add or remove keys.
- Do NOT translate JSON keys.
- Return ONLY valid JSON.

Summary JSON:
{json.dumps(summary, indent=2)}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return _parse_json_response(response.text, fallback={"error": "Translation failed."})


def generate_research_gaps(title: str, abstract: str, summary: dict) -> dict:
    """
    Analyze paper context and return research gaps / opportunities.
    """
    prompt = f"""
You are an expert research mentor specializing in identifying research gaps.

Analyze this paper carefully using the title, abstract, and AI summary.
Do NOT give generic advice. Base every point on this paper's specific content.

Title:
{title}

Abstract:
{abstract}

AI Summary:
{json.dumps(summary, indent=2)}

Return ONLY valid JSON with exactly this structure:

{{
  "research_gaps": ["specific gap 1", "specific gap 2", "specific gap 3"],
  "current_limitations": ["limitation 1", "limitation 2", "limitation 3"],
  "suggested_future_improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "possible_research_opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"]
}}

Return ONLY JSON.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return _parse_json_response(
        response.text,
        fallback={
            "research_gaps": [],
            "current_limitations": [],
            "suggested_future_improvements": [],
            "possible_research_opportunities": [],
            "error": "Research Gap generation failed.",
        },
    )