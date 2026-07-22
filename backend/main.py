from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from paper_search import search_papers
from citation_count import get_citation_count
from summary import (
    generate_summary,
    generate_chat_response,
    generate_comparison,
    translate_summary,
    generate_research_gaps,
)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # During local development allow all origins to avoid CORS issues.
    # Restrict this in production.
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummaryRequest(BaseModel):
    title: str
    abstract: str


class ChatRequest(BaseModel):
    title: str
    abstract: str
    summary: dict
    history: list[dict]
    question: str


class CompareRequest(BaseModel):
    paper_a: dict
    paper_b: dict


class TranslateRequest(BaseModel):
    summary: dict
    language: str


class ResearchGapsRequest(BaseModel):
    title: str
    abstract: str
    summary: dict


@app.get("/")
def home():
    return {
        "message": "ResearchMind AI Backend Running"
    }


@app.get("/search")
def search(topic: str):
    papers = search_papers(topic)
    return papers


@app.post("/summary")
def summary(request: SummaryRequest):
    try:
        ai_summary = generate_summary(request.title, request.abstract)
        return {"summary": ai_summary}
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to generate summary.")


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        ai_response = generate_chat_response(
            request.title,
            request.abstract,
            request.summary,
            request.history,
            request.question,
        )
        return {"response": ai_response}
    except Exception:
        raise HTTPException(status_code=500, detail="Chat response unavailable.")


@app.post("/compare")
def compare(request: CompareRequest):
    try:
        ai_comp = generate_comparison(request.paper_a, request.paper_b)
        return {"comparison": ai_comp}
    except Exception:
        raise HTTPException(status_code=500, detail="Comparison unavailable.")


@app.post("/translate")
def translate(request: TranslateRequest):
    if not request.summary:
        raise HTTPException(status_code=400, detail="Please generate AI Summary first.")
    try:
        translated = translate_summary(request.summary, request.language)
        if translated.get("error") and len(translated) <= 2:
            raise HTTPException(status_code=500, detail="Translation failed.")
        return {"translated": translated, "language": request.language}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Translation failed.")


@app.post("/research-gaps")
def research_gaps(request: ResearchGapsRequest):
    if not request.summary:
        raise HTTPException(status_code=400, detail="Please generate AI Summary first.")
    try:
        gaps = generate_research_gaps(request.title, request.abstract, request.summary)
        if gaps.get("error") and not gaps.get("research_gaps"):
            raise HTTPException(status_code=500, detail="Research Gap generation failed.")
        return {"gaps": gaps}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Research Gap generation failed.")


@app.get("/citation-count")
def citation_count(title: str, published: str = None):
    try:
        stats = get_citation_count(title, published)
        return stats
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to retrieve citation information.")
