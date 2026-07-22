# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"c:\Users\rohan\Desktop\Researchmind-AI\frontend\src\App.jsx")
text = path.read_text(encoding="utf-8")

# --- 1. Update AISummaryCard signature and implementation ---
old_sig = "function AISummaryCard({ paper, summary, loading, addToast }) {"
new_sig = "function AISummaryCard({ paper, summary, loading, addToast, onTranslate, onResearchGaps }) {"
if old_sig not in text:
    raise SystemExit("AISummaryCard signature not found")
text = text.replace(old_sig, new_sig, 1)

# Find and replace the return structure of AISummaryCard - from return ( through actions block end
# Locate start of return in AISummaryCard
start = text.find(new_sig)
ret = text.find("  return (", start)
# Find the actions div and sections - we'll rebuild the return opening

marker_start = text.find('    <div className={`ai-summary-card fade-in ${loading ? "ai-summary-card--loading" : ""}`}>', start)
# Find end of sections close before difficulty / closing of ai-summary-card - better approach:
# Replace only the actions toolbar section, and move it after sections.

# Find actions block
actions_start = text.find('      <div className="ai-summary-card__actions">', marker_start)
actions_end = text.find("      </div>\n\n      <div className=\"ai-summary-card__sections\">", actions_start)
if actions_start < 0 or actions_end < 0:
    # try alternate
    actions_end = text.find("      <div className=\"ai-summary-card__sections\">", actions_start)
    # need to find closing of actions before sections
    # walk back
    raise SystemExit(f"actions markers not found: {actions_start}, {actions_end}")

# The old actions block ends just before sections. We'll remove actions from top,
# then insert Summary Tools after sections (before final closing divs of card).

old_actions = text[actions_start:actions_end]
# Remove old actions from top (keep sections starting point)
text = text[:actions_start] + text[actions_end:]

# Now find end of sections - after difficulty section, before closing </div> of card
# Look for the pattern after difficulty ends
sections_close_marker = "      </div>\n    </div>\n  );\n}\n\nfunction ResearchMentorChat"
# But sections might close differently - AISummaryCard ends before ResearchMentorChat
end_card = text.find("\nfunction ResearchMentorChat", start)
card_chunk = text[marker_start:end_card]

# Find last occurrence of closing structure for sections + card inside AISummaryCard
# Typical ending after difficulty:
#        )}
#      </div>
#    </div>
#  );
#

# Insert Summary Tools before the closing of ai-summary-card (the sections container closes, then we add tools, then card closes)

# Find: after sections div closes - pattern `      </div>\n    </div>\n  );` near end of AISummaryCard
insert_anchor = text.rfind("      </div>\n    </div>\n  );\n}\n\nfunction ResearchMentorChat", start, end_card + 50)
if insert_anchor < 0:
    # try without extra newline variations
    insert_anchor = text.find("function ResearchMentorChat", start)
    # walk backwards for `    </div>\n  );`
    snippet = text[start:insert_anchor]
    # Look for closing of sections
    # sections open then content then `      </div>` then `    </div>`
    close_idx = snippet.rfind("      </div>\n    </div>\n  );")
    if close_idx < 0:
        close_idx = snippet.rfind("      </div>\n    </div>")
        if close_idx < 0:
            Path(r"c:\Users\rohan\Desktop\Researchmind-AI\frontend\_debug_end.txt").write_text(
                snippet[-800:], encoding="utf-8"
            )
            raise SystemExit("Could not find AISummaryCard close; wrote _debug_end.txt")
    insert_anchor = start + close_idx

summary_tools = '''      </div>

      <div className="summary-tools">
        <p className="summary-tools__label">Summary Tools</p>
        <div className="summary-tools__row">
          <button
            type="button"
            className="action-chip"
            disabled={loading}
            onClick={() => onTranslate && onTranslate(paper, summary)}
          >
            Translate Summary
          </button>
          <button
            type="button"
            className="action-chip"
            disabled={loading}
            onClick={() => onResearchGaps && onResearchGaps(paper, summary)}
          >
            Find Research Gaps
          </button>
          <button type="button" className="action-chip" onClick={handleCopySummary} disabled={loading}>
            {copyLabel}
          </button>
          <button type="button" className="action-chip" onClick={handleDownloadPdf} disabled={loading}>
            Download Summary
          </button>
          <div className="share-dropdown">
            <button type="button" className="action-chip" onClick={() => setShareMenuOpen((prev) => !prev)} disabled={loading}>
              {shareLabel}
            </button>
            {shareMenuOpen && (
              <div className="share-menu">
                <button type="button" className="share-menu-item" onClick={() => handleShareAction("whatsapp")}>Share via WhatsApp</button>
                <button type="button" className="share-menu-item" onClick={() => handleShareAction("email")}>Share via Email</button>
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

function ResearchMentorChat'''

# Replace from insert_anchor through ResearchMentorChat start
# insert_anchor points to `      </div>\n    </div>\n  );` - the first </div> closes sections
mentor_at = text.find("function ResearchMentorChat", start)
# From the sections close `      </div>` that closes sections - we need that first closing div preserved
# Structure should be:
#      </div>  <!-- end sections -->
#      <div className="summary-tools">...</div>
#    </div>  <!-- end card -->
#  );

# So replace starting at sections-end through function ResearchMentorChat

# Verify what's at insert_anchor
tail = text[insert_anchor:mentor_at]
# Prefer: find the sections closing exclusively
# After removing actions from top, sections still start with ai-summary-card__sections

if "ai-summary-card__sections" not in text[marker_start:mentor_at]:
    raise SystemExit("sections missing after actions removal")

# Replace the closing part
# Find last `      </div>` before `    </div>` before `  );` before ResearchMentorChat
before_mentor = text[:mentor_at]
# Match end pattern
import re
m = re.search(r"(      </div>\n    </div>\n  \);\n\}\n\n)$", before_mentor)
if not m:
    m = re.search(r"(      </div>\n    </div>\n  \);\n\})", before_mentor)
if not m:
    Path(r"c:\Users\rohan\Desktop\Researchmind-AI\frontend\_debug_end.txt").write_text(
        before_mentor[-1000:], encoding="utf-8"
    )
    raise SystemExit("end regex failed; wrote _debug_end.txt")

end_start = m.start(1)
text = before_mentor[:end_start] + summary_tools + "\n" + text[mentor_at:]

# Update copy/share default labels to match requested toolbar labels
text = text.replace(
    'const [copyLabel, setCopyLabel] = useState("📋 Copy Summary");',
    'const [copyLabel, setCopyLabel] = useState("Copy Summary");',
    1,
)
text = text.replace(
    'window.setTimeout(() => setCopyLabel("📋 Copy Summary"), 2000);',
    'window.setTimeout(() => setCopyLabel("Copy Summary"), 2000);',
    1,
)
text = text.replace(
    'const [shareLabel, setShareLabel] = useState("🔗 Share");',
    'const [shareLabel, setShareLabel] = useState("Share Summary");',
    1,
)

# --- 2. Paper card footer: only 5 buttons, Citation Count as secondary ---
old_footer = '''      <footer className="paper-card__footer">
        <button type="button" className="button-primary" onClick={handleAssistantClick} disabled={isLoading}>
          🧠 AI Research Assistant
        </button>
        <button type="button" className="button-secondary" onClick={handleSavePaper}>
          {alreadySaved ? "✓ Saved" : "⭐ Save Paper"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onCompare(paper)}>
          ⇄ Compare
        </button>
        <button type="button" className="button-secondary" onClick={() => onCitation(paper)}>
          Generate Citation
        </button>
        <button type="button" className="button-tertiary" onClick={() => onCitationCount(paper)}>
          Citation Count
        </button>
        <button
          type="button"
          className="button-tertiary"
          onClick={() => {
            if (!requireExistingSummary("Please generate AI Summary first.")) return;
            onTranslate(paper, summary);
          }}
        >
          Translate Summary
        </button>
        <button
          type="button"
          className="button-tertiary"
          onClick={() => {
            if (!requireExistingSummary("Please generate AI Summary first.")) return;
            onResearchGaps(paper, summary);
          }}
        >
          Find Research Gaps
        </button>
      </footer>'''

# Actual file may have slightly different emoji/labels — find dynamically
footer_pos = text.find('<footer className="paper-card__footer">')
# skip saved-footer if first is saved
if 'saved-footer' in text[footer_pos:footer_pos+80]:
    footer_pos = text.find('<footer className="paper-card__footer">', footer_pos + 1)

footer_end = text.find("</footer>", footer_pos) + len("</footer>")
old_actual = text[footer_pos:footer_end]

new_footer = '''<footer className="paper-card__footer paper-card__footer--paper-actions">
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
      </footer>'''

text = text[:footer_pos] + new_footer + text[footer_end:]

# Pass props to AISummaryCard
old_ais = "<AISummaryCard paper={paper} summary={summary} loading={isLoading} addToast={addToast} />"
new_ais = "<AISummaryCard paper={paper} summary={summary} loading={isLoading} addToast={addToast} onTranslate={onTranslate} onResearchGaps={onResearchGaps} />"
if old_ais not in text:
    raise SystemExit("AISummaryCard usage not found")
text = text.replace(old_ais, new_ais, 1)

# Remove unused requireExistingSummary if only used by translate/gaps - check
if "requireExistingSummary" in text:
    # may still be defined - remove function if unused
    if text.count("requireExistingSummary") == 1:
        # only definition left
        text = re.sub(
            r"\n  const requireExistingSummary = \(actionLabel\) => \{\n    if \(!summary\) \{\n      addToast\(actionLabel \|\| \"Please generate AI Summary first\.\"\);\n      return false;\n    \}\n    return true;\n  \};\n",
            "\n",
            text,
            count=1,
        )

path.write_text(text, encoding="utf-8")
print("App.jsx updated OK")
