import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const STORAGE_KEY = "researchmind_saved_papers";

const loadSavedPapers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSavedPapers = (papers) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
};

const buildPaperKey = (paper) => {
  const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "";
  return `${paper.title || ""}||${authors}||${paper.published || ""}`;
};

const sanitizeFilename = (title) => {
  return `${title}`
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
};

const copyTextToClipboard = async (text) => {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return true;
};

const buildSummaryText = (paper, summary) => {
  const lines = [paper.title || "ResearchMind Summary", ""];

  if (summary.overview) {
    lines.push("Overview:", summary.overview, "");
  }

  if (summary.key_contributions?.length) {
    lines.push("Key Contributions:");
    summary.key_contributions.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.methodology?.length) {
    lines.push("Methodology:");
    summary.methodology.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.evaluation?.length) {
    lines.push("Evaluation:");
    summary.evaluation.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.applications?.length) {
    lines.push("Applications:");
    summary.applications.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.limitations?.length) {
    lines.push("Limitations:");
    summary.limitations.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.future_work?.length) {
    lines.push("Future Work:");
    summary.future_work.forEach((item) => lines.push(`• ${item}`));
    lines.push("");
  }

  if (summary.difficulty) {
    lines.push("Difficulty:", summary.difficulty.level || "", "");
    if (summary.difficulty.reason) {
      lines.push("Reason:", summary.difficulty.reason, "");
    }
  }

  return lines.join("\n");
};

const buildShareMessage = (paper, summary) => {
  const full = buildSummaryText(paper, summary);
  const parts = full.split("\n");
  const summaryBody = parts.length > 1 ? parts.slice(parts[1] === "" ? 2 : 1).join("\n").trim() : full;
  const linkLine = paper.pdf ? ["", "Link:", paper.pdf].join("\n") : "";
  return [
    "ResearchMind",
    "",
    "Paper:",
    paper.title || "Untitled paper",
    "",
    "AI Summary",
    "",
    summaryBody || "AI Summary not available.",
    linkLine,
    "",
    "Generated using ResearchMind.",
  ]
    .filter(Boolean)
    .join("\n");
};

const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

const getApiBase = () => {
  const host = window.location.hostname || "127.0.0.1";
  return `http://${host}:8000`;
};

const createSummaryPdf = (paper, summary) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 18;
  let y = margin;

  const addPageIfNeeded = (extraHeight = 0) => {
    if (y + extraHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addTextBlock = (text, fontSize = 11) => {
    doc.setFontSize(fontSize);
    doc.setTextColor("#334155");
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line) => {
      addPageIfNeeded(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
  };

  const addSection = (title, content) => {
    if (!content) {
      return;
    }
    doc.setFontSize(13);
    doc.setTextColor("#111827");
    addPageIfNeeded(24);
    doc.text(title, margin, y);
    y += 22;
    addTextBlock(content, 11);
    y += 8;
  };

  const addBulletSection = (title, items) => {
    if (!items?.length) {
      return;
    }
    doc.setFontSize(13);
    doc.setTextColor("#111827");
    addPageIfNeeded(24);
    doc.text(title, margin, y);
    y += 22;
    doc.setFontSize(11);
    doc.setTextColor("#334155");
    items.forEach((item) => {
      const lines = doc.splitTextToSize(item, maxWidth - 18);
      addPageIfNeeded(lineHeight * lines.length);
      doc.text("•", margin, y);
      lines.forEach((line, idx) => {
        doc.text(line, margin + 18, y + idx * lineHeight);
      });
      y += lineHeight * lines.length + 8;
    });
    y += 4;
  };

  doc.setFontSize(18);
  doc.setTextColor("#111827");
  doc.text("ResearchMind", margin, y);
  y += 28;

  doc.setFontSize(11);
  doc.setTextColor("#6b7280");
  doc.text(`Generated using ResearchMind`, margin, y);
  y += 18;
  doc.text(`Generation Date: ${new Date().toLocaleDateString()}`, margin, y);
  y += 26;

  addSection("Paper Title:", paper.title || "Untitled paper");
  addSection("Authors:", Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "Not available");
  addSection("Published:", paper.published || "Not available");
  addSection("Overview:", summary.overview);
  addBulletSection("Key Contributions:", summary.key_contributions);
  addBulletSection("Methodology:", summary.methodology);
  addBulletSection("Evaluation:", summary.evaluation);
  addBulletSection("Applications:", summary.applications);
  addBulletSection("Limitations:", summary.limitations);
  addBulletSection("Future Work:", summary.future_work);

  if (summary.difficulty) {
    addSection("Difficulty:", summary.difficulty.level || "");
    addSection("Reason:", summary.difficulty.reason || "");
  }

  const citationText = `${paper.title || "Untitled"} | ${Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "Unknown author"} | ${paper.published || "n.d."}`;
  addSection("Citation:", citationText);
  addSection("Original Paper Link:", paper.pdf || "Not available");

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(10);
    doc.setTextColor("#6b7280");
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - margin / 2, {
      align: "right",
    });
  }

  return doc;
};

function SearchBar({ topic, onTopicChange, onSearch, searching }) {
  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <span className="search-input-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 0 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M16.5 16.5 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search by topic, keyword, or paper title..."
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
        />
      </div>

      <button
        type="button"
        className="search-button"
        onClick={onSearch}
        disabled={searching || !topic.trim()}
      >
        {searching ? (
          <span className="button-content">
            <span className="spinner" aria-hidden="true" />
            Searching
          </span>
        ) : (
          "Search"
        )}
      </button>
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-message">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function SkeletonLoader({ label = "Loading..." }) {
  return (
    <div className="skeleton-loader" role="status" aria-live="polite">
      <div className="skeleton-line skeleton-line--lg" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line--md" />
      <div className="skeleton-line skeleton-line--sm" />
      <span className="skeleton-label">{label}</span>
    </div>
  );
}

function SavedPage({ savedPapers, filter, sortOrder, onFilterChange, onSortChange, onDelete, onClearAll, onOpenPdf, onGenerateSummary, onCompare, onCitation }) {
  const filtered = useMemo(() => {
    const search = filter.trim().toLowerCase();
    return savedPapers
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(search) ||
          item.authors.toLowerCase().includes(search) ||
          item.published.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const aDate = new Date(a.timestamp).getTime();
        const bDate = new Date(b.timestamp).getTime();
        return sortOrder === "oldest" ? aDate - bDate : bDate - aDate;
      });
  }, [savedPapers, filter, sortOrder]);

  return (
    <section className="saved-page">
      <div className="saved-controls">
        <input
          type="search"
          placeholder="Search saved papers"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
        <select value={sortOrder} onChange={(event) => onSortChange(event.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        <button type="button" className="button-secondary" onClick={onClearAll}>
          Clear all saved papers
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No saved papers</h3>
          <p>Save a paper from the search results to see it here.</p>
        </div>
      ) : (
        <div className="results-list">
          {filtered.map((item) => (
            <SavedPaperCard
              key={item.key}
              paper={item}
              onDelete={onDelete}
              onOpenPdf={onOpenPdf}
              onGenerateSummary={onGenerateSummary}
              onCompare={onCompare}
              onCitation={onCitation}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SavedPaperCard({ paper, onDelete, onOpenPdf, onGenerateSummary, onCompare, onCitation }) {
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(paper.aiSummary || null);
  const hasSummary = Boolean(summaryData);

  const handleOpenSummary = async () => {
    if (hasSummary) {
      setSummaryVisible((prev) => !prev);
      return;
    }

    setLoading(true);
    const result = await onGenerateSummary(paper, paper.key);
    setLoading(false);

    if (result) {
      setSummaryData(result);
      setSummaryVisible(true);
    }
  };

  return (
    <article className="paper-card saved-paper-card saved-paper-card--clean">
      <div className="paper-card__body">
        <div className="paper-card__header">
          <h2>{paper.title}</h2>
        </div>

        <div className="paper-card__meta">
          <div className="paper-card__meta-row">
            <p className="section-label">Authors</p>
            <p className="paper-card__meta-value">{paper.authors}</p>
          </div>
          <div className="paper-card__meta-row">
            <p className="section-label">Published</p>
            <p className="paper-card__meta-value">{paper.published}</p>
          </div>
        </div>
      </div>

      <footer className="paper-card__footer saved-footer">
        <button type="button" className="button-tertiary" onClick={() => onOpenPdf(paper)}>
          Open PDF
        </button>
        <button type="button" className="button-secondary" onClick={handleOpenSummary} disabled={loading}>
          {loading ? "Generating AI Summary..." : summaryVisible ? "Hide AI Summary" : "Open AI Summary"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onCompare(paper)}>
          Compare
        </button>
        <button type="button" className="button-secondary" onClick={() => onCitation(paper)}>
          Generate Citation
        </button>
        <button type="button" className="button-danger" onClick={() => onDelete(paper.key)}>
          Delete
        </button>
      </footer>

      {summaryVisible && hasSummary && (
        <div className="ai-summary-card ai-summary-card--saved">
          <div className="ai-summary-card__sections">
            <section className="ai-summary-card__section-card">
              <div className="section-heading">Overview</div>
              <p>{summaryData.overview}</p>
            </section>
            {summaryData.key_contributions?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Key Contributions</div>
                <ul>
                  {summaryData.key_contributions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.methodology?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Methodology</div>
                <ul>
                  {summaryData.methodology.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.evaluation?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Evaluation</div>
                <ul>
                  {summaryData.evaluation.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.applications?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Applications</div>
                <ul>
                  {summaryData.applications.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.limitations?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Limitations</div>
                <ul>
                  {summaryData.limitations.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.future_work?.length > 0 && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Future Work</div>
                <ul>
                  {summaryData.future_work.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {summaryData.difficulty && (
              <section className="ai-summary-card__section-card">
                <div className="section-heading">Difficulty</div>
                <div className="difficulty-row">
                  <span className={`difficulty-badge badge-${summaryData.difficulty.level?.toLowerCase().includes("intermediate") ? "intermediate" : summaryData.difficulty.level?.toLowerCase().includes("beginner") ? "beginner" : "advanced"}`}>
                    {summaryData.difficulty.level}
                  </span>
                </div>
                <p className="section-subheading">Reason</p>
                <p>{summaryData.difficulty.reason}</p>
              </section>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function AISummaryCard({ paper, summary, loading, addToast, onTranslate, onResearchGaps }) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy Summary");
  const [shareLabel, setShareLabel] = useState("Share Summary");

  const summaryText = useMemo(() => buildSummaryText(paper, summary), [paper, summary]);
  const shareMessage = useMemo(() => buildShareMessage(paper, summary), [paper, summary]);

  const handleCopySummary = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(summaryText);
    setCopyLabel("✓ Summary Copied");
    addToast("✓ Summary Copied");
    window.setTimeout(() => setCopyLabel("Copy Summary"), 2000);
  };

  const handleDownloadPdf = () => {
    const doc = createSummaryPdf(paper, summary);
    const filename = `${sanitizeFilename(paper.title || "paper")}-ResearchMind-Summary.pdf`;
    doc.save(filename);
    addToast("✓ Summary PDF Downloaded");
  };

  const handleOriginalPdf = () => {
    if (paper.pdf) {
      window.open(paper.pdf, "_blank", "noopener,noreferrer");
      return;
    }
    addToast("Original paper PDF unavailable.");
  };

  const requireSummary = () => {
    if (!summary) {
      addToast("Please generate the AI Summary before sharing.");
      return false;
    }
    return true;
  };

  const shareViaEmail = () => {
    if (!requireSummary()) return false;
    const subject = `Research Paper Summary - ${paper.title || "Untitled paper"}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
    const anchor = document.createElement("a");
    anchor.href = mailtoUrl;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  };

  const handleNativeShare = async () => {
    if (!requireSummary()) return;

    if (!navigator.share) {
      shareViaEmail();
      setShareMenuOpen(false);
      return;
    }

    try {
      await navigator.share({
        title: paper.title || "ResearchMind Summary",
        text: shareMessage,
      });
      addToast("✓ Shared Successfully");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      shareViaEmail();
    } finally {
      setShareMenuOpen(false);
    }
  };

  const handleShareAction = async (action) => {
    if (!requireSummary()) {
      setShareMenuOpen(false);
      return;
    }

    if (action === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
      addToast("✓ Shared Successfully");
      setShareMenuOpen(false);
      return;
    }

    if (action === "email") {
      shareViaEmail();
      setShareMenuOpen(false);
      return;
    }
  };

  const difficulty = summary.difficulty || {};
  const difficultyLabel = difficulty.level || "";
  const difficultyType = difficultyLabel.toLowerCase().includes("intermediate")
    ? "intermediate"
    : difficultyLabel.toLowerCase().includes("beginner")
    ? "beginner"
    : "advanced";

  return (
    <div className={`ai-summary-card fade-in ${loading ? "ai-summary-card--loading" : ""}`}>
      <h4 className="assistant-workspace__section-title">AI Summary</h4>
      <div className="ai-summary-card__sections">
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Overview</div>
          <p>{summary.overview}</p>
        </section>

        {summary.key_contributions?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Key Contributions</div>
            <ul>
              {summary.key_contributions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.methodology?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Methodology</div>
            <ul>
              {summary.methodology.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.evaluation?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Evaluation</div>
            <ul>
              {summary.evaluation.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.applications?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Applications</div>
            <ul>
              {summary.applications.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.limitations?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Limitations</div>
            <ul>
              {summary.limitations.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.future_work?.length > 0 && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Future Work</div>
            <ul>
              {summary.future_work.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.difficulty && (
          <section className="ai-summary-card__section-card">
            <div className="section-heading">Difficulty</div>
            <div className="difficulty-row">
              <span className={`difficulty-badge badge-${difficultyType}`}>{difficultyLabel}</span>
            </div>
            <p className="section-subheading">Reason</p>
            <p>{summary.difficulty.reason}</p>
          </section>
        )}
      </div>

      <div className="summary-tools">
        <p className="summary-tools__label">Summary Tools</p>
        <div className="summary-tools__row">
          <button
            type="button"
            className="action-chip"
            disabled={loading}
            onClick={() => onTranslate && onTranslate(paper, summary)}
          >
            <span className="action-chip__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M12 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <span className="action-chip__label">Translate</span>
          </button>
          <button
            type="button"
            className="action-chip"
            disabled={loading}
            onClick={() => onResearchGaps && onResearchGaps(paper, summary)}
          >
            <span className="action-chip__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="action-chip__label">Research Gaps</span>
          </button>
          <button type="button" className="action-chip" onClick={handleCopySummary} disabled={loading}>
            <span className="action-chip__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="4" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 8h-1a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="action-chip__label">{copyLabel}</span>
          </button>
          <button type="button" className="action-chip" onClick={handleDownloadPdf} disabled={loading}>
            <span className="action-chip__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M5 16v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="action-chip__label">Download</span>
          </button>
          <div className="share-dropdown">
            <button type="button" className="action-chip" onClick={() => setShareMenuOpen((prev) => !prev)} disabled={loading}>
              <span className="action-chip__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 12v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="m10 8 2-2 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 6v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="action-chip__label">{shareLabel}</span>
            </button>
            {shareMenuOpen && (
              <div className="share-menu">
                <button type="button" className="share-menu-item" onClick={() => handleShareAction("whatsapp")}>Share via WhatsApp</button>
                <button type="button" className="share-menu-item" onClick={handleNativeShare}>
                  Native Share
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchMentorChat({ paper, summary, addToast }) {
  const [chatHistory, setChatHistory] = useState([
    {
      role: "assistant",
      message: "I can help you unpack this paper, compare it with other models, and explain key ideas in plain language.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [voiceState, setVoiceState] = useState("idle");
  const recognitionRef = useRef(null);
  const voiceResultRef = useRef(false);
  const stoppedByUserRef = useRef(false);
  const voiceStateRef = useRef("idle");
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, chatLoading]);

  const sendChat = async (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setChatHistory((prev) => [...prev, { role: "user", message: trimmed }]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const backendHost = window.location.hostname || "127.0.0.1";
      const response = await fetch(`http://${backendHost}:8000/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paper.title,
          abstract: paper.summary || paper.abstract || "",
          summary,
          history: [...chatHistory, { role: "user", message: trimmed }],
          question: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();
      const answer = data.response || "ResearchMind AI could not generate a response.";
      setChatHistory((prev) => [...prev, { role: "assistant", message: answer }]);
      addToast("✓ Research Mentor response received");
    } catch {
      setChatError("Unable to fetch chat response. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat(chatInput);
    }
  };

  const resetVoiceState = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore any abort errors
      }
      recognitionRef.current = null;
    }
    voiceResultRef.current = false;
    stoppedByUserRef.current = false;
    voiceStateRef.current = "idle";
    setVoiceState("idle");
  };

  const startVoiceListening = () => {
    if (!SpeechRecognition) {
      addToast("Voice input is not supported in this browser.");
      return;
    }

    if (chatLoading) {
      return;
    }

    if (voiceState === "listening") {
      stoppedByUserRef.current = true;
      resetVoiceState();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    voiceResultRef.current = false;
    stoppedByUserRef.current = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      voiceStateRef.current = "listening";
      setVoiceState("listening");
    };

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        voiceResultRef.current = true;
        voiceStateRef.current = "processing";
        setVoiceState("processing");
        setChatInput(transcript);
        await sendChat(transcript);
        if (voiceStateRef.current === "processing") {
          voiceStateRef.current = "idle";
          setVoiceState("idle");
        }
      }
    };

    recognition.onerror = (event) => {
      const errorType = event.error;
      if (errorType === "not-allowed" || errorType === "security") {
        addToast("Microphone access was denied.");
      } else if (errorType === "no-speech" || errorType === "audio-capture") {
        addToast("No speech detected. Please try again.");
      } else {
        addToast("Voice input failed. Please try again.");
      }
      resetVoiceState();
    };

    recognition.onend = () => {
      const shouldShowNoSpeech = !voiceResultRef.current && !stoppedByUserRef.current;
      if (voiceStateRef.current !== "processing") {
        resetVoiceState();
      } else {
        recognitionRef.current = null;
      }
      if (shouldShowNoSpeech) {
        addToast("No speech detected. Please try again.");
      }
    };

    try {
      recognition.start();
    } catch {
      addToast("Voice input could not be started.");
      resetVoiceState();
    }
  };

  const chatMessages = chatHistory.map((item, idx) => (
    <div key={`${item.role}-${idx}`} className={`chat-message chat-message--${item.role}`}>
      <div className="chat-message__bubble">
        <div className="chat-message__role">{item.role === "assistant" ? "ResearchMind AI" : "You"}</div>
        <p>{item.message}</p>
      </div>
      {item.role === "assistant" && (
        <div className="chat-message__actions">
          <button
            type="button"
            className="chat-message__action"
            onClick={async () => {
              await copyTextToClipboard(item.message);
              addToast("✓ Copied to clipboard");
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v10h8V6H9Zm-2 3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h-2v1H5v-7h2V9Z" />
            </svg>
            <span>Copy</span>
          </button>
        </div>
      )}
    </div>
  ));

  return (
    <div className="assistant-chat chat-panel">
      <h4 className="assistant-workspace__section-title">Research Chat</h4>
      <div className="chat-panel__body">
        <div className="chat-history" aria-live="polite" ref={chatContainerRef}>
          {chatMessages.length > 0 ? chatMessages : <p className="chat-empty">Start by asking a question.</p>}
          {chatLoading && (
            <div className="chat-loading compact-loading">
              <span className="spinner" aria-hidden="true" />
              <span>Thinking...</span>
            </div>
          )}
          {chatError && <div className="chat-error">{chatError}</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-composer">
          <div className="chat-composer__input">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this paper..."
              rows={1}
            />
          </div>
          <div className="chat-composer__actions">
            {SpeechRecognition && (
              <button
                type="button"
                className={`chat-action-button mic-button ${voiceState === "listening" ? "mic-button--listening" : ""} ${voiceState === "processing" ? "mic-button--processing" : ""}`}
                onClick={startVoiceListening}
                disabled={chatLoading}
                aria-label={voiceState === "listening" ? "Stop voice input" : voiceState === "processing" ? "Processing voice input" : "Voice input"}
                title={voiceState === "listening" ? "Stop voice input" : voiceState === "processing" ? "Processing voice input" : "Voice input"}
              >
                {voiceState === "listening" ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm-5 1h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9 19h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 19v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : voiceState === "processing" ? (
                  <span className="voice-icon-check" aria-hidden="true">✓</span>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm-5 1h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9 19h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 19v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            )}
            <button type="button" className="chat-action-button chat-action-button--primary" onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()}>
              Send
            </button>
          </div>
        </div>
        {voiceState !== "idle" && (
          <div className={`voice-status ${voiceState === "processing" ? "voice-status--processing" : ""}`}>
            {voiceState === "processing" ? (
              <>
                <span className="voice-status__check" aria-hidden="true">✓</span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <div className="voice-status__bars" aria-hidden="true">
                  {[0, 1, 2, 3].map((bar) => (
                    <span key={bar} className="voice-status__bar" style={{ animationDelay: `${bar * 0.08}s` }} />
                  ))}
                </div>
                <span>Listening...</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


const comparisonSectionLabels = {
  research_problem: "Research Problem",
  objective: "Objective",
  methodology: "Methodology",
  dataset: "Dataset",
  model: "Model / Algorithm",
  model_architecture: "Model / Algorithm",
  contributions: "Key Contributions",
  results: "Results",
  strengths: "Strengths",
  weaknesses: "Weaknesses",
  limitations: "Weaknesses",
  advantages: "Strengths",
  applications: "Applications",
  future_work: "Future Work",
};

const comparisonSectionOrder = [
  "research_problem",
  "objective",
  "methodology",
  "dataset",
  "model",
  "model_architecture",
  "contributions",
  "results",
  "strengths",
  "weaknesses",
  "limitations",
  "advantages",
  "applications",
  "future_work",
];

const normalizeTextValue = (value) => {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextValue(item))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const nestedText = value.text || value.summary || value.description || value.recommendation;
    if (typeof nestedText === "string") {
      return nestedText.trim();
    }
    return "";
  }
  return String(value).trim();
};

const normalizeSideBySideValue = (value) => {
  if (!value) {
    return { paperA: "", paperB: "" };
  }

  if (typeof value === "string") {
    return { paperA: value, paperB: "" };
  }

  if (Array.isArray(value)) {
    return { paperA: normalizeTextValue(value), paperB: "" };
  }

  if (typeof value === "object") {
    const paperA = normalizeTextValue(value.paper_a || value.paperA || value.a || value.left || value.first);
    const paperB = normalizeTextValue(value.paper_b || value.paperB || value.b || value.right || value.second);
    if (paperA || paperB) {
      return { paperA, paperB };
    }

    const fallbackText = normalizeTextValue(value.text || value.summary || value.description);
    return { paperA: fallbackText, paperB: "" };
  }

  return { paperA: normalizeTextValue(value), paperB: "" };
};

const parseComparisonData = (comparison) => {
  if (!comparison) return null;

  if (typeof comparison === "string") {
    const trimmed = comparison.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return parseComparisonData(parsed);
    } catch {
      return { raw_text: trimmed };
    }
  }

  if (typeof comparison !== "object" || Array.isArray(comparison)) {
    return null;
  }

  return comparison;
};

const extractComparisonRows = (comparison) => {
  const parsed = parseComparisonData(comparison);
  if (!parsed) {
    return [];
  }

  const rows = [];
  const seen = new Set();

  comparisonSectionOrder.forEach((key) => {
    if (!(key in parsed)) return;
    const normalized = normalizeSideBySideValue(parsed[key]);
    if (!normalized.paperA && !normalized.paperB) return;
    seen.add(key);
    rows.push({
      key,
      label: comparisonSectionLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      paperA: normalized.paperA,
      paperB: normalized.paperB,
    });
  });

  Object.entries(parsed).forEach(([key, value]) => {
    if (seen.has(key)) return;
    const normalized = normalizeSideBySideValue(value);
    if (!normalized.paperA && !normalized.paperB) return;
    rows.push({
      key,
      label: comparisonSectionLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      paperA: normalized.paperA,
      paperB: normalized.paperB,
    });
  });

  return rows;
};

const extractRecommendation = (comparison) => {
  const parsed = parseComparisonData(comparison);
  if (!parsed) return "";

  const candidateKeys = ["final_opinion", "recommendation", "ai_recommendation", "summary", "overall_recommendation"];
  for (const key of candidateKeys) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "object") {
      const directValue = normalizeTextValue(value.text || value.recommendation || value.summary || value.description);
      if (directValue) return directValue;
    }
  }

  const rowMap = {};
  Object.entries(parsed).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const paperA = normalizeTextValue(value.paper_a || value.paperA || value.a || value.left || value.first);
      const paperB = normalizeTextValue(value.paper_b || value.paperB || value.b || value.right || value.second);
      rowMap[key] = { paperA, paperB };
    } else {
      rowMap[key] = { paperA: normalizeTextValue(value), paperB: "" };
    }
  });

  const getFirstLine = (text) => text.split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] || "";
  const strengthA = getFirstLine(rowMap.strengths?.paperA || rowMap.advantages?.paperA || "");
  const strengthB = getFirstLine(rowMap.strengths?.paperB || rowMap.advantages?.paperB || "");
  const weaknessA = getFirstLine(rowMap.weaknesses?.paperA || rowMap.limitations?.paperA || "");
  const weaknessB = getFirstLine(rowMap.weaknesses?.paperB || rowMap.limitations?.paperB || "");

  if (strengthA || strengthB) {
    const clauses = [];
    if (strengthA) clauses.push(`Paper A is more suitable when you want ${strengthA.toLowerCase()}.`);
    if (strengthB) clauses.push(`Paper B is more appropriate when you need ${strengthB.toLowerCase()}.`);
    if (weaknessA || weaknessB) {
      if (weaknessA) clauses.push(`Paper A may be less ideal if ${weaknessA.toLowerCase()}.`);
      if (weaknessB) clauses.push(`Paper B may be less ideal if ${weaknessB.toLowerCase()}.`);
    }
    clauses.push("For most practical research use cases, choose the paper whose strengths align best with your objective.");
    return clauses.join(" ");
  }

  if (typeof parsed === "object" && parsed.raw_text) {
    return "The comparison highlights trade-offs between the two papers. Review the table above to choose the paper that best fits your use case.";
  }

  return "The comparison highlights distinct strengths in each paper. Review the table above to choose the option that best matches your research goals.";
};

function CompareModal({ open, onClose, papers, comparison, loading, error }) {
  if (!open) return null;
  const [a = {}, b = {}] = papers;

  const sectionRows = useMemo(() => extractComparisonRows(comparison), [comparison]);
  const finalOpinion = useMemo(() => extractRecommendation(comparison), [comparison]);

  const formatSectionLabel = (key) =>
    comparisonSectionLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const renderCellValue = (value) => {
    if (!value) {
      return <span className="compare-table__empty">Not available</span>;
    }

    const lines = String(value)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      return (
        <div className="compare-table__stack">
          {lines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      );
    }

    return <p>{String(value)}</p>;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Compare Papers</h3>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>

        <div className="compare-head">
          <div className="compare-title">{a.title || "Paper A"}</div>
          <div className="compare-vs">VS</div>
          <div className="compare-title">{b.title || "Paper B"}</div>
        </div>

        {loading && <SkeletonLoader label="Generating AI comparison..." />}

        {!loading && error && (
          <div className="empty-state">
            <h3>Unable to generate comparison.</h3>
            <p>Please try again.</p>
          </div>
        )}

        {!loading && !error && comparison && (
          <>
            {sectionRows.length > 0 ? (
              <div className="compare-table-wrap">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Paper A</th>
                      <th>Paper B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRows.map((row) => (
                      <tr key={row.key}>
                        <td className="compare-table__category">{row.label}</td>
                        <td>{renderCellValue(row.paperA)}</td>
                        <td>{renderCellValue(row.paperB)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compare-empty-state">
                <h3>No comparison details available.</h3>
                <p>The response did not include structured comparison information.</p>
              </div>
            )}

            {finalOpinion && (
              <div className="ai-recommendation">
                <h4>AI Recommendation</h4>
                <p>{typeof finalOpinion === "string" ? finalOpinion : String(finalOpinion)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CitationModal({ open, onClose, paper, addToast }) {
  const [format, setFormat] = useState('IEEE');
  if (!open) return null;

  const makeAuthors = (authors) => {
    if (!authors) return '';
    if (Array.isArray(authors)) return authors.join(', ');
    return authors;
  };

  const title = paper.title || '';
  const authors = makeAuthors(paper.authors);
  const parsedYear = paper.published ? new Date(paper.published).getFullYear() : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : '';
  const url = paper.pdf || '';
  const venue = paper.journal || paper.source || 'arXiv';
  const doi = paper.doi || '';

  const fmt = (fmtName) => {
    if (fmtName === 'APA') {
      const source = doi ? `https://doi.org/${doi}` : url;
      return `${authors} (${year}). ${title}. ${venue}. ${source}`.trim();
    }

    if (fmtName === 'MLA') {
      const source = doi ? `https://doi.org/${doi}` : url;
      return `${authors}. "${title}." ${venue}, ${year}. ${source}`.trim();
    }

    if (fmtName === 'IEEE') {
      const source = doi ? `doi:${doi}` : url ? `Available: ${url}` : '';
      return `${authors}, "${title}," ${venue}, ${year}. [Online]. ${source}`.trim();
    }

    if (fmtName === 'BibTeX') {
      const key = (title || 'paper').replace(/\W+/g, '_').slice(0, 40);
      const fields = [`  title = {${title}}`, `  author = {${authors}}`, `  journal = {${venue}}`, `  year = {${year}}`];
      if (url) fields.push(`  url = {${url}}`);
      if (doi) fields.push(`  doi = {${doi}}`);
      return `@article{${key},\n${fields.join(',\n')}\n}`;
    }

    return '';
  };

  const citationText = fmt(format);

  const copyCitation = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(citationText);
    addToast('Citation copied successfully.');
  };

  const downloadCitation = () => {
    const blob = new Blob([citationText], { type: 'text/plain;charset=utf-8' });
    const filename = `${title ? title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-') : 'citation'}-${format}.txt`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Generate Citation</h3>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>

        <div className="segmented-tabs" role="tablist">
          {["IEEE", "APA", "MLA", "BibTeX"].map((fmtName) => (
            <button
              key={fmtName}
              type="button"
              role="tab"
              aria-selected={format === fmtName}
              className={`segmented-tab ${format === fmtName ? "segmented-tab--active" : ""}`}
              onClick={() => setFormat(fmtName)}
            >
              {fmtName}
            </button>
          ))}
        </div>

        <pre className="citation-output" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {citationText}
        </pre>

        <div className="modal-actions modal-actions--sticky">
          <button className="button-primary" onClick={copyCitation}>Copy Citation</button>
          <button className="button-secondary" onClick={downloadCitation}>Download Citation (.txt)</button>
        </div>
      </div>
    </div>
  );
}

function renderBulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p>Not available</p>;
  }
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function CitationCountModal({ open, onClose, paper, data, loading, error }) {
  if (!open) return null;

  const unavailable = !loading && (error || !data || data.available === false);

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Citation Statistics</h3>
          <button type="button" className="text-button" onClick={onClose}>Close</button>
        </div>
        <p className="feature-modal-subtitle">{paper?.title || "Selected paper"}</p>

        {loading && (
          <SkeletonLoader label="Retrieving citation data..." />
        )}

        {!loading && unavailable && (
          <div className="empty-state">
            <h3>Citation data unavailable.</h3>
            <p>{error || data?.message || "Unable to retrieve citation information."}</p>
          </div>
        )}

        {!loading && !unavailable && data && (
          <div className="stats-grid">
            <div className="stat-card">
              <p className="section-label">Total Citations</p>
              <p className="stat-value">{data.total_citations ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="section-label">Average Citations Per Year</p>
              <p className="stat-value">{data.average_citations_per_year ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="section-label">Publication Year</p>
              <p className="stat-value">{data.publication_year ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="section-label">Years Since Publication</p>
              <p className="stat-value">{data.years_since_publication ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="section-label">Estimated Research Impact</p>
              <p className="stat-value">{data.estimated_research_impact ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="section-label">Highly Influential</p>
              <p className="stat-value">{data.highly_influential ?? "—"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TranslateModal({ open, onClose, paper, language, onLanguageChange, translated, original, loading, error, languages }) {
  if (!open) return null;

  const renderSummaryPanels = (summaryData) => (
    <>
      {summaryData.overview && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Overview</div>
          <p>{summaryData.overview}</p>
        </section>
      )}
      {summaryData.key_contributions?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Key Contributions</div>
          {renderBulletList(summaryData.key_contributions)}
        </section>
      )}
      {summaryData.methodology?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Methodology</div>
          {renderBulletList(summaryData.methodology)}
        </section>
      )}
      {summaryData.evaluation?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Evaluation</div>
          {renderBulletList(summaryData.evaluation)}
        </section>
      )}
      {summaryData.applications?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Applications</div>
          {renderBulletList(summaryData.applications)}
        </section>
      )}
      {summaryData.limitations?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Limitations</div>
          {renderBulletList(summaryData.limitations)}
        </section>
      )}
      {summaryData.future_work?.length > 0 && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Future Work</div>
          {renderBulletList(summaryData.future_work)}
        </section>
      )}
      {summaryData.difficulty && (
        <section className="ai-summary-card__section-card">
          <div className="section-heading">Difficulty</div>
          <p>{summaryData.difficulty.level}</p>
          <p>{summaryData.difficulty.reason}</p>
        </section>
      )}
    </>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Translate Summary</h3>
          <button type="button" className="text-button" onClick={onClose}>Close</button>
        </div>
        {paper?.title && <p className="feature-modal-subtitle">{paper.title}</p>}

        <div className="language-select-row">
          <div className="language-select-label">Language</div>
          <div className="language-options">
            {languages.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`language-option ${language === lang ? "language-option--active" : ""}`}
                onClick={() => onLanguageChange(lang)}
              >
                <span className="language-option__radio" aria-hidden="true">
                  {language === lang ? "●" : "○"}
                </span>
                <span>{lang}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="summary-loading"><span className="spinner" /> Translating summary...</div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <h3>Translation failed.</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && translated && (
          original ? (
            <div className="translate-columns">
              <div className="translate-panel">
                <h4>Original Summary</h4>
                {renderSummaryPanels(original)}
              </div>
              <div className="translate-panel">
                <h4>Translated Summary</h4>
                {renderSummaryPanels(translated)}
              </div>
            </div>
          ) : (
            <div className="ai-summary-card__sections translate-result">
              {renderSummaryPanels(translated)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ResearchGapsModal({ open, onClose, data, loading, error }) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header modal-header--beige">
          <h3>Research Gaps</h3>
          <button type="button" className="text-button" onClick={onClose}>Close</button>
        </div>

        {loading && (
          <div className="summary-loading"><span className="spinner" /> Analyzing research gaps...</div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <h3>Research Gap generation failed.</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="gap-cards">
            <div className="gap-card">
              <h4>Research Gaps</h4>
              {renderBulletList(data.research_gaps)}
            </div>
            <div className="gap-card">
              <h4>Current Limitations</h4>
              {renderBulletList(data.current_limitations)}
            </div>
            <div className="gap-card">
              <h4>Suggested Future Improvements</h4>
              {renderBulletList(data.suggested_future_improvements)}
            </div>
            <div className="gap-card gap-card--highlight">
              <h4>Suggested Research Direction</h4>
              {renderBulletList(data.possible_research_opportunities)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaperCard({
  paper,
  index,
  generateSummary,
  summaries,
  loadingSummary,
  savedPapers,
  onSavePaper,
  onCompare,
  onCitation,
  onCitationCount,
  onTranslate,
  onResearchGaps,
  addToast,
  isRelated = false,
}) {
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedMoreLoading, setRelatedMoreLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(null);
  const [relatedPapers, setRelatedPapers] = useState([]);
  const [relatedLimit, setRelatedLimit] = useState(3);
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const abstractText = paper.summary || paper.abstract || "Not available";
  const isLongAbstract = abstractText.length > 280;
  const preview = isLongAbstract ? `${abstractText.slice(0, 277)}...` : abstractText;
  const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "Not available";
  const published = paper.published || "Not available";
  const summary = summaries[index];
  const isLoading = Boolean(loadingSummary[index]);
  const paperKey = buildPaperKey(paper);
  const alreadySaved = savedPapers.some((item) => item.key === paperKey);
  const relatedVisiblePapers = relatedPapers.slice(0, relatedLimit);


  const handleAssistantClick = async () => {
    if (summary) {
      setSummaryVisible((prev) => !prev);
      setChatEnabled(true);
      return;
    }
    const generated = await generateSummary(paper, index);
    if (generated) {
      setSummaryVisible(true);
      setChatEnabled(true);
    }
  };

  const handleRelatedClick = async () => {
    const nextOpen = !relatedOpen;
    setRelatedOpen(nextOpen);
    if (!nextOpen || relatedPapers.length > 0 || relatedLoading) {
      return;
    }

    setRelatedLoading(true);
    setRelatedError(null);
    try {
      const url = `${getApiBase()}/search?topic=${encodeURIComponent(paper.title)}`;
      let response;
      try {
        response = await fetch(url);
      } catch {
        response = await fetch(`http://127.0.0.1:8000/search?topic=${encodeURIComponent(paper.title)}`);
      }
      if (!response.ok) {
        throw new Error();
      }
      const data = await response.json();
      const parentTitle = (paper.title || "").trim().toLowerCase();
      const related = (Array.isArray(data) ? data : []).filter(
        (item) => (item.title || "").trim().toLowerCase() !== parentTitle
      );
      setRelatedPapers(related);
      setRelatedLimit(3);
      if (related.length === 0) {
        setRelatedError("No related papers found.");
      } else {
        addToast("✓ Related Papers Loaded");
      }
    } catch {
      setRelatedError("Unable to load related papers.");
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleLoadMoreRelated = async () => {
    setRelatedMoreLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    setRelatedLimit((prev) => Math.min(prev + 5, relatedPapers.length));
    setRelatedMoreLoading(false);
  };

  const handleSavePaper = () => {
    onSavePaper(paper, summary);
  };

  return (
    <article className={`paper-card ${isRelated ? "paper-card--related" : ""}`}>
      {isRelated && <span className="related-badge">Related Paper</span>}
      <div className="paper-card__body">
        <div className="paper-card__header">
          <h2>{paper.title || "Untitled paper"}</h2>
          <a className="paper-card__pdf-button" href={paper.pdf || "#"} target="_blank" rel="noreferrer">
            Read PDF
          </a>
        </div>

        <div className="paper-card__meta">
          <div className="paper-card__meta-row">
            <p className="section-label">Authors</p>
            <p className="paper-card__meta-value">{authors}</p>
          </div>
          <div className="paper-card__meta-row">
            <p className="section-label">Published</p>
            <p className="paper-card__meta-value">{published}</p>
          </div>
        </div>

        <div className="paper-card__section">
          <div className="section-label">Abstract</div>
          <p className="paper-card__summary">
            {abstractExpanded ? abstractText : preview}
            {isLongAbstract && (
              <button type="button" className="text-button" onClick={() => setAbstractExpanded((prev) => !prev)}>
                {abstractExpanded ? "Read Less" : "Read More"}
              </button>
            )}
          </p>
        </div>
      </div>

      <footer className="paper-card__footer paper-card__footer--paper-actions">
        <button type="button" className="button-primary" onClick={handleAssistantClick} disabled={isLoading}>
          AI Research Assistant
        </button>
        <button type="button" className="button-secondary" onClick={handleSavePaper}>
          {alreadySaved ? "Saved" : "Save"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onCompare(paper)}>
          Compare
        </button>
        <button type="button" className="button-secondary" onClick={() => onCitation(paper)}>
          Generate Citation
        </button>
        <button type="button" className="button-secondary" onClick={() => onCitationCount(paper)}>
          Citation Count
        </button>
      </footer>

      {isLoading && <SkeletonLoader label="Generating AI Summary..." />}

      {summary && (
        <div className={`assistant-shell ${summaryVisible ? "open" : "collapsed"}`}>
          <div className="assistant-shell__header">
            <h3>AI Research Assistant</h3>
            <p>Summary and conversation for this paper</p>
          </div>
          <div className="assistant-shell__body">
            <AISummaryCard paper={paper} summary={summary} loading={isLoading} addToast={addToast} onTranslate={onTranslate} onResearchGaps={onResearchGaps} />
            {chatEnabled && summaryVisible && (
              <ResearchMentorChat key={paperKey} paper={paper} summary={summary} addToast={addToast} />
            )}
          </div>
        </div>
      )}

      {!isRelated && (
        <div className="related-panel">
          <button type="button" className="text-button" onClick={handleRelatedClick}>
            {relatedOpen ? "Hide Related Papers" : "Related Papers"}
          </button>
          {relatedOpen && (
            <div className="related-content">
              {relatedLoading && (
                <div className="related-loading">
                  <span className="spinner" /> Finding Related Papers...
                </div>
              )}
              {relatedError && <p className="related-error">{relatedError}</p>}
              {relatedVisiblePapers.length > 0 && (
                <div className="results-list related-list">
                  {relatedVisiblePapers.map((relatedPaper, relIndex) => {
                    const relatedIndex = `${index}-rel-${relIndex}`;
                    return (
                      <PaperCard
                        key={relatedIndex}
                        paper={relatedPaper}
                        index={relatedIndex}
                        generateSummary={generateSummary}
                        summaries={summaries}
                        loadingSummary={loadingSummary}
                        savedPapers={savedPapers}
                        onSavePaper={onSavePaper}
                        onCompare={onCompare}
                        onCitation={onCitation}
                        onCitationCount={onCitationCount}
                        onTranslate={onTranslate}
                        onResearchGaps={onResearchGaps}
                        addToast={addToast}
                        isRelated={true}
                      />
                    );
                  })}
                </div>
              )}
              {relatedPapers.length > 0 && !relatedLoading && (
                <div className="related-footer">
                  {relatedLimit < relatedPapers.length ? (
                    <button type="button" className="button-primary" onClick={handleLoadMoreRelated} disabled={relatedMoreLoading}>
                      {relatedMoreLoading ? <><span className="spinner" /> Loading more...</> : "Show More"}
                    </button>
                  ) : (
                    <span className="related-end">No more related papers.</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function App() {
  const [topic, setTopic] = useState("");
  const [papers, setPapers] = useState([]);
  const [page, setPage] = useState("search");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [loadingSummary, setLoadingSummary] = useState({});
  const [savedPapers, setSavedPapers] = useState([]);
  const [savedFilter, setSavedFilter] = useState("");
  const [savedSort, setSavedSort] = useState("newest");
  const [toasts, setToasts] = useState([]);
  const [compareSelection, setCompareSelection] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [citationPaper, setCitationPaper] = useState(null);
  const [citationCountOpen, setCitationCountOpen] = useState(false);
  const [citationCountPaper, setCitationCountPaper] = useState(null);
  const [citationCountData, setCitationCountData] = useState(null);
  const [citationCountLoading, setCitationCountLoading] = useState(false);
  const [citationCountError, setCitationCountError] = useState(null);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translatePaper, setTranslatePaper] = useState(null);
  const [translateSourceSummary, setTranslateSourceSummary] = useState(null);
  const [translateLanguage, setTranslateLanguage] = useState("Urdu");
  const [translatedSummary, setTranslatedSummary] = useState(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState(null);
  const [researchGapsOpen, setResearchGapsOpen] = useState(false);
  const [researchGapsData, setResearchGapsData] = useState(null);
  const [researchGapsLoading, setResearchGapsLoading] = useState(false);
  const [researchGapsError, setResearchGapsError] = useState(null);

  const translateRequestRef = useRef(0);

  const TRANSLATE_LANGUAGES = ["Urdu", "Arabic", "French", "German", "Spanish", "Chinese"];

  useEffect(() => {
    setSavedPapers(loadSavedPapers());
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 760) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    saveSavedPapers(savedPapers);
  }, [savedPapers]);

  useEffect(() => {
    const handler = (e) => addToast(e.detail || '');
    document.addEventListener('toast', handler);
    return () => document.removeEventListener('toast', handler);
  }, []);

  const addToast = (message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const createPaperKey = (paper) => {
    const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "";
    return `${paper.title || ""}||${authors}||${paper.published || ""}`;
  };

  const toggleCompareSelection = (paper) => {
    const key = createPaperKey(paper);
    setCompareSelection((prev) => {
      const exists = prev.find((p) => p.key === key);
      if (exists) return prev.filter((p) => p.key !== key);
      if (prev.length >= 2) {
        addToast('You can compare only two papers at a time.');
        return prev;
      }
      return [...prev, { ...paper, key }];
    });
  };

  const openCitationModal = (paper) => {
    setCitationPaper(paper);
    setCitationModalOpen(true);
  };

  const openCitationCountModal = async (paper) => {
    setCitationCountPaper(paper);
    setCitationCountOpen(true);
    setCitationCountData(null);
    setCitationCountError(null);
    setCitationCountLoading(true);
    try {
      const params = new URLSearchParams({
        title: paper.title || "",
      });
      if (paper.published) params.set("published", paper.published);
      let response;
      try {
        response = await fetch(`${getApiBase()}/citation-count?${params.toString()}`);
      } catch {
        response = await fetch(`http://127.0.0.1:8000/citation-count?${params.toString()}`);
      }
      if (!response.ok) {
        throw new Error("Unable to retrieve citation information.");
      }
      const data = await response.json();
      setCitationCountData(data);
      if (data.available === false) {
        setCitationCountError(data.message || "Citation data unavailable.");
      }
    } catch {
      setCitationCountData(null);
      setCitationCountError("Unable to retrieve citation information.");
      addToast("Unable to retrieve citation information.");
    } finally {
      setCitationCountLoading(false);
    }
  };

  const runTranslate = async (summary, language) => {
    const requestId = ++translateRequestRef.current;
    setTranslateLoading(true);
    setTranslateError(null);
    setTranslatedSummary(null);
    try {
      let response;
      try {
        response = await fetch(`${getApiBase()}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, language }),
        });
      } catch {
        response = await fetch("http://127.0.0.1:8000/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, language }),
        });
      }
      if (!response.ok) {
        throw new Error("Translation failed.");
      }
      const data = await response.json();
      if (!data.translated) {
        throw new Error("Translation failed.");
      }
      if (translateRequestRef.current === requestId) {
        setTranslatedSummary(data.translated);
      }
    } catch {
      if (translateRequestRef.current === requestId) {
        setTranslatedSummary(null);
        setTranslateError("Translation failed.");
        addToast("Translation failed.");
      }
    } finally {
      if (translateRequestRef.current === requestId) {
        setTranslateLoading(false);
      }
    }
  };

  const openTranslateModal = (paper, summary) => {
    if (!summary) {
      addToast("Please generate AI Summary first.");
      return;
    }
    const initialLanguage = TRANSLATE_LANGUAGES[0];
    setTranslatePaper(paper);
    setTranslateSourceSummary(summary);
    setTranslateLanguage(initialLanguage);
    setTranslatedSummary(null);
    setTranslateError(null);
    setTranslateOpen(true);
    runTranslate(summary, initialLanguage);
  };

  const handleTranslateLanguageChange = (language) => {
    setTranslateLanguage(language);
    if (translateSourceSummary) {
      runTranslate(translateSourceSummary, language);
    }
  };

  const openResearchGapsModal = async (paper, summary) => {
    if (!summary) {
      addToast("Please generate AI Summary first.");
      return;
    }
    setResearchGapsOpen(true);
    setResearchGapsData(null);
    setResearchGapsError(null);
    setResearchGapsLoading(true);
    try {
      const body = {
        title: paper.title || "",
        abstract: paper.abstract || paper.summary || "",
        summary,
      };
      let response;
      try {
        response = await fetch(`${getApiBase()}/research-gaps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        response = await fetch("http://127.0.0.1:8000/research-gaps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!response.ok) {
        throw new Error("Research Gap generation failed.");
      }
      const data = await response.json();
      if (!data.gaps) {
        throw new Error("Research Gap generation failed.");
      }
      setResearchGapsData(data.gaps);
    } catch {
      setResearchGapsData(null);
      setResearchGapsError("Research Gap generation failed.");
      addToast("Research Gap generation failed.");
    } finally {
      setResearchGapsLoading(false);
    }
  };

  const handleCompare = async () => {
    if (compareSelection.length !== 2) {
      if (compareSelection.length === 0) {
        addToast('Select two papers to compare.');
      } else if (compareSelection.length === 1) {
        addToast('Select one more paper to compare.');
      }
      return;
    }

    setCompareLoading(true);
    setComparisonResult(null);
    setCompareError(null);
    setCompareModalOpen(true);

    try {
      const papersToCompare = await Promise.all(
        compareSelection.map(async (paper) => {
          const existingAbstract =
            paper.abstract && paper.abstract !== 'Not available'
              ? paper.abstract
              : paper.summary && paper.summary !== 'Not available'
                ? paper.summary
                : '';

          if (existingAbstract) {
            return { ...paper, abstract: existingAbstract, summary: existingAbstract };
          }

          const fetched = await fetchPaperDetails(paper.title);
          const resolvedAbstract = fetched.summary || fetched.abstract || '';
          return {
            ...paper,
            abstract: resolvedAbstract,
            summary: resolvedAbstract,
            pdf: fetched.pdf || paper.pdf,
            authors: fetched.authors || paper.authors,
            published: fetched.published || paper.published,
          };
        })
      );

      const body = {
        paper_a: {
          title: papersToCompare[0].title,
          abstract: papersToCompare[0].abstract || papersToCompare[0].summary || '',
        },
        paper_b: {
          title: papersToCompare[1].title,
          abstract: papersToCompare[1].abstract || papersToCompare[1].summary || '',
        },
      };

      if (!body.paper_a.abstract || !body.paper_b.abstract) {
        throw new Error('Paper abstract unavailable.');
      }

      const response = await fetch('http://127.0.0.1:8000/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();
      setComparisonResult(data.comparison || data);
    } catch {
      setComparisonResult(null);
      setCompareError('Unable to generate comparison. Please try again.');
      addToast('Unable to generate comparison. Please try again.');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleSavePaper = (paper, summary) => {
    const key = createPaperKey(paper);
    if (savedPapers.some((item) => item.key === key)) {
      addToast("✓ Saved");
      return;
    }

    const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors || "Not available";
    const savedPaper = {
      key,
      title: paper.title || "Untitled paper",
      authors,
      published: paper.published || "Not available",
      pdf: paper.pdf || "",
      abstract: paper.summary || paper.abstract || "Not available",
      aiSummary: summary || null,
      timestamp: new Date().toISOString(),
    };

    setSavedPapers((prev) => [savedPaper, ...prev]);
    addToast("✓ Paper Saved");
  };

  const handleDeleteSavedPaper = (key) => {
    setSavedPapers((prev) => prev.filter((item) => item.key !== key));
    addToast("✓ Removed from Saved Papers");
  };

  const handleClearSavedPapers = () => {
    setSavedPapers([]);
    addToast("✓ Removed all saved papers");
  };

  const openSavedPdf = (paper) => {
    if (paper.pdf) {
      window.open(paper.pdf, "_blank", "noopener,noreferrer");
      return;
    }
    addToast("Original paper PDF unavailable.");
  };

  const fetchPaperDetails = async (title) => {
    const backendHost = window.location.hostname || "127.0.0.1";
    const urlCandidate1 = `http://${backendHost}:8000/search?topic=${encodeURIComponent(title)}`;
    const urlCandidate2 = `http://127.0.0.1:8000/search?topic=${encodeURIComponent(title)}`;

    let response = null;
    try {
      response = await fetch(urlCandidate1);
    } catch (err1) {
      try {
        response = await fetch(urlCandidate2);
      } catch (err2) {
        throw err2 || err1;
      }
    }

    if (!response.ok) {
      throw new Error("Unable to fetch paper details.");
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No paper details found.");
    }

    return data[0];
  };

  const generateSummary = async (paper, index) => {
    try {
      setLoadingSummary((prev) => ({ ...prev, [index]: true }));

      let resolvedPaper = { ...paper };
      const existingAbstract = paper.abstract && paper.abstract !== "Not available" ? paper.abstract : paper.summary || "";

      if (!existingAbstract) {
        const fetched = await fetchPaperDetails(paper.title);
        resolvedPaper = {
          ...resolvedPaper,
          abstract: fetched.summary || fetched.abstract || "",
          summary: fetched.summary || fetched.abstract || "",
          pdf: fetched.pdf || resolvedPaper.pdf,
          authors: fetched.authors || resolvedPaper.authors,
          published: fetched.published || resolvedPaper.published,
        };
      } else {
        resolvedPaper.abstract = existingAbstract;
      }

      if (!resolvedPaper.abstract) {
        throw new Error("Paper abstract unavailable.");
      }

      const response = await fetch("http://127.0.0.1:8000/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: resolvedPaper.title,
          abstract: resolvedPaper.abstract,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate summary.");
      }

      const data = await response.json();
      if (!data.summary) {
        throw new Error("Invalid summary response.");
      }

      setSummaries((prev) => ({ ...prev, [index]: data.summary }));
      setSavedPapers((prev) =>
        prev.map((item) =>
          item.key === paper.key
            ? {
                ...item,
                abstract: resolvedPaper.abstract,
                aiSummary: data.summary,
                pdf: resolvedPaper.pdf || item.pdf,
                authors: resolvedPaper.authors || item.authors,
                published: resolvedPaper.published || item.published,
              }
            : item
        )
      );

      return data.summary;
    } catch {
      addToast("Unable to generate summary. Please try again.");
      return null;
    } finally {
      setLoadingSummary((prev) => ({ ...prev, [index]: false }));
    }
  };

  const searchPapers = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      return;
    }

    try {
      setStatus("searching");
      setError(null);

      const backendHost = window.location.hostname || "127.0.0.1";
      const urlCandidate1 = `http://${backendHost}:8000/search?topic=${encodeURIComponent(trimmedTopic)}`;
      const urlCandidate2 = `http://127.0.0.1:8000/search?topic=${encodeURIComponent(trimmedTopic)}`;

      let response = null;
      try {
        response = await fetch(urlCandidate1);
      } catch (err1) {
        try {
          response = await fetch(urlCandidate2);
        } catch (err2) {
          throw err2 || err1;
        }
      }

      if (!response.ok) {
        setError(`Request failed: ${response.status}`);
        setStatus("error");
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        setError("Unexpected response from the server.");
        setStatus("error");
        return;
      }

      setPapers(data);
      setStatus("done");
    } catch {
      setError("We couldn't fetch papers right now. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="app-shell">
      <header className="top-navigation">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">
            <img src="/researchmind-logo.svg" alt="" />
          </span>
          <span className="brand-text">ResearchMind</span>
        </div>

        <div className="top-navigation__actions">
          <nav className="top-navigation__nav" aria-label="Primary">
            <button type="button" className={`top-navigation__item ${page === "search" ? "top-navigation__item--active" : ""}`} onClick={() => { setPage("search"); setMobileMenuOpen(false); }}>Home</button>
            <button type="button" className={`top-navigation__item ${page === "saved" ? "top-navigation__item--active" : ""}`} onClick={() => { setPage("saved"); setMobileMenuOpen(false); }}>Saved Papers</button>
          </nav>

          <button
            type="button"
            className="top-navigation__mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-nav-panel" className="top-navigation__mobile-panel" role="navigation" aria-label="Mobile navigation">
            <button type="button" className={`top-navigation__item ${page === "search" ? "top-navigation__item--active" : ""}`} onClick={() => { setPage("search"); setMobileMenuOpen(false); }}>Home</button>
            <button type="button" className={`top-navigation__item ${page === "saved" ? "top-navigation__item--active" : ""}`} onClick={() => { setPage("saved"); setMobileMenuOpen(false); }}>Saved Papers</button>
          </div>
        )}
      </header>

      <section className="hero full-width">
        <div className="hero-inner">
          <p className="eyebrow">ResearchMind</p>
          <h1>AI-Powered Research Assistant</h1>
          <p className="hero-subtitle">
            Discover, understand, and compare research papers with AI.
          </p>

          {page === "search" && (
            <SearchBar topic={topic} onTopicChange={setTopic} onSearch={searchPapers} searching={status === "searching"} />
          )}
        </div>
      </section>

      {page === "search" && (
        <div className="status-message" role="status" aria-live="polite">
          {status === "searching" && "Searching for papers..."}
          {status === "done" && papers.length > 0 && `Showing ${papers.length} paper${papers.length === 1 ? "" : "s"}.`}
          {status === "done" && papers.length === 0 && "No papers found for this topic."}
          {status === "error" && error}
        </div>
      )}

      {page === "search" && status === "searching" && (
        <div className="loading-state" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Gathering the best matches...</p>
        </div>
      )}

      {page === "search" && status === "done" && papers.length === 0 && (
        <div className="empty-state">
          <h3>No papers found</h3>
          <p>Try a broader topic or check your spelling and try again.</p>
        </div>
      )}

      {page === "search" && status === "error" && (
        <div className="empty-state">
          <h3>We hit a snag</h3>
          <p>{error}</p>
        </div>
      )}

      {page === "search" && status === "done" && papers.length > 0 && (
        <div className="results-list">
          {papers.map((paper, index) => (
            <PaperCard
              key={`${paper.title}-${index}`}
              paper={paper}
              index={index}
              generateSummary={generateSummary}
              summaries={summaries}
              loadingSummary={loadingSummary}
              savedPapers={savedPapers}
              onSavePaper={handleSavePaper}
              onCompare={toggleCompareSelection}
              onCitation={openCitationModal}
              onCitationCount={openCitationCountModal}
              onTranslate={openTranslateModal}
              onResearchGaps={openResearchGapsModal}
              addToast={addToast}
            />
          ))}
        </div>
      )}

      {page === "saved" && (
        <SavedPage
          savedPapers={savedPapers}
          filter={savedFilter}
          sortOrder={savedSort}
          onFilterChange={setSavedFilter}
          onSortChange={setSavedSort}
          onDelete={handleDeleteSavedPaper}
          onClearAll={handleClearSavedPapers}
          onOpenPdf={openSavedPdf}
          onGenerateSummary={generateSummary}
          onCompare={toggleCompareSelection}
          onCitation={openCitationModal}
        />
      )}

      {compareSelection.length > 0 && (
        <div className="compare-floating">
          <div>{compareSelection.length} selected</div>
          <button className="button-primary" onClick={handleCompare} disabled={compareSelection.length !== 2 || compareLoading}>
            {compareLoading ? 'Generating comparison...' : 'Compare Papers'}
          </button>
          <button className="text-button" onClick={() => setCompareSelection([])}>Clear</button>
        </div>
      )}

      <CompareModal
        open={compareModalOpen}
        onClose={() => {
          setCompareModalOpen(false);
          setComparisonResult(null);
          setCompareLoading(false);
          setCompareError(null);
          setCompareSelection([]);
        }}
        papers={compareSelection}
        comparison={comparisonResult}
        loading={compareLoading}
        error={compareError}
      />

      <CitationModal open={citationModalOpen} onClose={() => setCitationModalOpen(false)} paper={citationPaper || {}} addToast={addToast} />

      <CitationCountModal
        open={citationCountOpen}
        onClose={() => {
          setCitationCountOpen(false);
          setCitationCountData(null);
          setCitationCountError(null);
          setCitationCountLoading(false);
        }}
        paper={citationCountPaper}
        data={citationCountData}
        loading={citationCountLoading}
        error={citationCountError}
      />

      <TranslateModal
        open={translateOpen}
        onClose={() => {
          translateRequestRef.current += 1;
          setTranslateOpen(false);
          setTranslatedSummary(null);
          setTranslateError(null);
          setTranslateLoading(false);
          setTranslatePaper(null);
          setTranslateSourceSummary(null);
        }}
        paper={translatePaper}
        language={translateLanguage}
        onLanguageChange={handleTranslateLanguageChange}
        translated={translatedSummary}
        original={translateSourceSummary}
        loading={translateLoading}
        error={translateError}
        languages={TRANSLATE_LANGUAGES}
      />

      <ResearchGapsModal
        open={researchGapsOpen}
        onClose={() => {
          setResearchGapsOpen(false);
          setResearchGapsData(null);
          setResearchGapsError(null);
          setResearchGapsLoading(false);
        }}
        data={researchGapsData}
        loading={researchGapsLoading}
        error={researchGapsError}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
