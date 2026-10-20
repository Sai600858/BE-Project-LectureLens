/**
 * StudyNotesViewer.jsx
 * 
 * Rich, responsive viewer for AI-generated study notes with:
 * - Mathematical notation rendered via KaTeX
 * - Inline educational diagrams (coordinate graphs, algorithms, flowcharts, concept maps)
 *   placed immediately after the relevant formula or concept
 * - Interactive variable breakdowns (symbol, meaning, unit)
 * - Step-by-step derivations and examples
 * - Enlarge / zoom modal for complex diagrams
 * - Graceful fallback states
 */
import React, { useEffect, useRef, useState } from 'react';

/* ── KaTeX Loader Helper ─────────────────────────────────────────────────── */
let katexLoaded = false;
function ensureKatex(cb) {
  if (typeof window.katex !== 'undefined') { cb(); return; }
  if (katexLoaded) {
    const t = setInterval(() => { if (window.katex) { clearInterval(t); cb(); } }, 100);
    return;
  }
  katexLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
  script.onload = cb;
  document.head.appendChild(script);
}

function InlineMath({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    const clean = (latex || '').replace(/^\$+|\$+$/g, '').trim();
    if (!clean) return;
    ensureKatex(() => {
      if (ref.current && window.katex) {
        try {
          window.katex.render(clean, ref.current, { throwOnError: false, displayMode: false });
        } catch (_) {}
      }
    });
  }, [latex]);
  return <span ref={ref} style={{ color: '#38bdf8', fontWeight: 'bold' }}>{latex}</span>;
}

function BlockMath({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    const clean = (latex || '').replace(/^\$+|\$+$/g, '').trim();
    if (!clean) return;
    ensureKatex(() => {
      if (ref.current && window.katex) {
        try {
          window.katex.render(clean, ref.current, { throwOnError: false, displayMode: true });
        } catch (_) {}
      }
    });
  }, [latex]);
  return (
    <div style={styles.blockMathWrap}>
      <div ref={ref} style={{ overflowX: 'auto', textAlign: 'center', padding: '6px 0' }}>
        <code>{latex}</code>
      </div>
    </div>
  );
}

function resolveVizImage(viz) {
  if (!viz) return null;
  const p = viz.imagePath || viz.sourceSnapshotPath || viz.imageBase64 || viz.spec?.imagePath || '';
  if (!p) return null;
  if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) return p;
  const filename = p.split(/[/\\]/).pop();
  const apiBase = import.meta.env.VITE_API_URL || '';
  return `${apiBase}/snapshots/${filename}`;
}

/* ── Diagram Enlarge Modal ───────────────────────────────────────────────── */
function DiagramModal({ title, svg, image, caption, onClose }) {
  if (!svg && !image) return null;
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h4 style={styles.modalTitle}>🔍 {title || 'Visual Zoom View'}</h4>
          <button onClick={onClose} style={styles.modalCloseBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : image ? (
            <img src={image} alt={title || 'Lecture Diagram'} style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '8px' }} />
          ) : null}
        </div>
        {caption && <p style={styles.modalCaption}>{caption}</p>}
      </div>
    </div>
  );
}

/* ── Single Inline Visualization Card ────────────────────────────────────── */
function InlineVisualizationCard({ viz, onEnlarge }) {
  if (!viz) return null;
  const { title, type, caption, connectionToFormula, svg } = viz;
  const imageUrl = resolveVizImage(viz);

  const typeLabels = {
    coordinate_graph: '📈 Coordinate Graph & Function Plot',
    algorithm_steps: '⚡ Algorithm Execution Steps',
    flowchart: '🔄 Process Flowchart',
    concept_map: '🧠 Architectural Concept Map',
    formula_breakdown: '🧮 Variable-by-Variable Breakdown',
    preserved_source_diagram: '📸 Preserved Board/Slide Diagram',
    null_coalesce_flow: '🗄️ SQL NULL Handling Flow',
    string_transformation: '🔤 String Transformation Pipeline',
    date_timeline: '⏱️ Date & Time Timeline',
  };

  return (
    <div style={styles.vizCard}>
      <div style={styles.vizHeader}>
        <div>
          <span style={styles.vizTypeBadge}>{typeLabels[type] || `📐 ${type}`}</span>
          <h4 style={styles.vizTitle}>{title}</h4>
        </div>
        {(svg || imageUrl) && (
          <button
            onClick={() => onEnlarge && onEnlarge({ ...viz, imageUrl })}
            style={styles.enlargeBtn}
            title="Enlarge visual"
          >
            🔍 Enlarge
          </button>
        )}
      </div>

      {svg ? (
        <div
          style={styles.svgContainer}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : imageUrl ? (
        <div style={styles.imgContainer} onClick={() => onEnlarge && onEnlarge({ ...viz, imageUrl })}>
          <img
            src={imageUrl}
            alt={title || caption || 'Lecture snapshot'}
            style={styles.vizImg}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div style={styles.vizFallback}>
          <span>Visual specification captured: {caption || title}</span>
        </div>
      )}

      {caption && <p style={styles.vizCaption}><strong>Figure:</strong> {caption}</p>}

      {connectionToFormula && (
        <div style={styles.vizConnectionBox}>
          <span style={{ fontSize: '13px' }}>🔗</span>
          <span style={styles.vizConnectionText}>
            <strong>How the visual explains the formula:</strong> {connectionToFormula}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main StudyNotesViewer ───────────────────────────────────────────────── */
export default function StudyNotesViewer({ studyNotes, isLoading }) {
  const [zoomViz, setZoomViz] = useState(null);

  if (isLoading) {
    return (
      <div style={styles.loadingBox}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
        <h4 style={{ color: '#38bdf8', margin: '0 0 6px 0' }}>Synthesizing Notes & Generating Visual Explanations…</h4>
        <p style={{ color: '#71717a', fontSize: '13px', margin: 0 }}>
          Extracting mathematical formulas, checking concepts, and building deterministic graphs.
        </p>
      </div>
    );
  }

  if (!studyNotes) {
    return (
      <div style={styles.emptyBox}>
        <span style={{ fontSize: '32px' }}>📖</span>
        <p style={{ margin: '8px 0 0 0', color: '#71717a' }}>No study notes generated yet.</p>
      </div>
    );
  }

  const { title, sections = [], visualizations = [], questions = [], contentMarkdown = '' } = studyNotes;

  // If structured sections exist, render structured educational view
  const hasSections = Array.isArray(sections) && sections.length > 0;

  return (
    <div style={styles.container}>
      {zoomViz && (
        <DiagramModal
          title={zoomViz.title}
          svg={zoomViz.svg}
          image={zoomViz.imageUrl || resolveVizImage(zoomViz)}
          caption={zoomViz.caption}
          onClose={() => setZoomViz(null)}
        />
      )}

      {/* Header */}
      <div style={styles.notesHeader}>
        <h2 style={styles.mainTitle}>{title || 'Lecture Study Notes'}</h2>
        <div style={styles.modeBadge}>
          🎓 Intelligent Multimodal Synthesis
        </div>
      </div>

      {/* Structured Sections */}
      {hasSections ? (
        <div style={styles.sectionsList}>
          {sections.map((sec, idx) => {
            const viz = sec.visualization && sec.visualization.required
              ? sec.visualization
              : visualizations.find((v) => v.id === `viz_${idx + 1}` || v.sectionHeading === sec.heading);

            return (
              <section key={idx} style={styles.sectionCard}>
                {/* Heading */}
                <h3 style={styles.sectionHeading}>
                  <span style={styles.sectionNumber}>{idx + 1}</span> {sec.heading}
                </h3>

                {/* Formula (if any) */}
                {sec.formula && (
                  <div style={styles.formulaSection}>
                    <div style={styles.labelPill}>MATHEMATICAL FORMULA</div>
                    <BlockMath latex={sec.formula} />
                  </div>
                )}

                {/* Explanation */}
                {sec.explanation && (
                  <div style={styles.explanationSection}>
                    <div style={styles.labelPill}>CONCEPT EXPLANATION</div>
                    <p style={styles.explanationText}>{sec.explanation}</p>
                  </div>
                )}

                {/* Variables & Symbols Breakdown */}
                {Array.isArray(sec.variables) && sec.variables.length > 0 && (
                  <div style={styles.variablesBox}>
                    <div style={styles.variablesTitle}>📐 Symbols & Variable Meanings:</div>
                    <div style={styles.variablesGrid}>
                      {sec.variables.map((v, vi) => (
                        <div key={vi} style={styles.varItem}>
                          <div style={styles.varSymbol}>
                            <InlineMath latex={`$${v.symbol}$`} />
                          </div>
                          <div style={styles.varDetail}>
                            <span style={styles.varMeaning}>{v.meaning}</span>
                            {v.unit && <span style={styles.varUnit}> [{v.unit}]</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-Step Example / Derivation */}
                {sec.derivationOrExample && (
                  <div style={styles.derivationBox}>
                    <div style={styles.derivationHeader}>🧪 Practical Example / Step-by-Step Derivation:</div>
                    <p style={styles.derivationText}>{sec.derivationOrExample}</p>
                  </div>
                )}

                {/* INLINE EMBEDDED DIAGRAM / VISUALIZATION */}
                {viz && (
                  <InlineVisualizationCard
                    viz={viz}
                    onEnlarge={(v) => setZoomViz(v)}
                  />
                )}

                {/* Key Revision Takeaway */}
                {sec.takeaway && (
                  <div style={styles.takeawayBox}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <div>
                      <strong style={styles.takeawayTitle}>Key Revision Takeaway:</strong>
                      <p style={styles.takeawayText}>{sec.takeaway}</p>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        /* Fallback Markdown View for legacy notes */
        <div style={styles.legacyMarkdownView}>
          <pre style={styles.rawMarkdown}>{contentMarkdown}</pre>
        </div>
      )}

      {/* Review & Exam Questions */}
      {Array.isArray(questions) && questions.length > 0 && (
        <div style={styles.questionsCard}>
          <h3 style={styles.questionsHeader}>❓ Review & Examination Questions</h3>
          <div style={styles.questionsList}>
            {questions.map((q, qi) => (
              <div key={qi} style={styles.questionItem}>
                <div style={styles.qText}>
                  <strong>Q{qi + 1}:</strong> {q.question}
                </div>
                {q.hint && (
                  <div style={styles.qHint}>
                    💡 <em>Hint:</em> {q.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES – Responsive & Dark Mode Aesthetic
══════════════════════════════════════════════════════════════ */
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '920px',
    margin: '0 auto',
    width: '100%',
  },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    borderBottom: '1px solid #27272a',
    paddingBottom: '16px',
  },
  mainTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
  },
  modeBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    background: '#0284c722',
    border: '1px solid #0284c755',
    padding: '4px 10px',
    borderRadius: '999px',
  },
  sectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  sectionCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#f8fafc',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sectionNumber: {
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '800',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelPill: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#71717a',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  formulaSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  blockMathWrap: {
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '14px',
  },
  explanationSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  explanationText: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: '1.7',
    margin: 0,
  },
  variablesBox: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  variablesTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  variablesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '8px',
  },
  varItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#182032',
    border: '1px solid #1e3a8a33',
    padding: '6px 10px',
    borderRadius: '6px',
  },
  varSymbol: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  varDetail: {
    fontSize: '12px',
    color: '#cbd5e1',
  },
  varMeaning: {
    fontWeight: '500',
  },
  varUnit: {
    color: '#38bdf8',
    fontSize: '11px',
  },
  derivationBox: {
    background: '#131b2e',
    border: '1px solid #1e3a8a55',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  derivationHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#93c5fd',
    marginBottom: '6px',
  },
  derivationText: {
    fontSize: '13px',
    color: '#dbeafe',
    lineHeight: '1.6',
    margin: 0,
  },

  /* Inline Visualization Card */
  vizCard: {
    background: '#090d16',
    border: '1px solid #3b82f655',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  vizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vizTypeBadge: {
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: '800',
    color: '#60a5fa',
    background: '#2563eb22',
    border: '1px solid #2563eb44',
    padding: '2px 8px',
    borderRadius: '4px',
    marginBottom: '4px',
    textTransform: 'uppercase',
  },
  vizTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  enlargeBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#93c5fd',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  svgContainer: {
    overflowX: 'auto',
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0',
  },
  imgContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px',
    background: '#090d16',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    cursor: 'zoom-in',
    maxHeight: '340px',
    overflow: 'hidden',
  },
  vizImg: {
    maxWidth: '100%',
    maxHeight: '320px',
    objectFit: 'contain',
    borderRadius: '6px',
    display: 'block',
  },
  vizFallback: {
    padding: '20px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '12px',
  },
  vizCaption: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.5',
    fontStyle: 'italic',
  },
  vizConnectionBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: '#1e3a8a22',
    borderLeft: '3px solid #3b82f6',
    padding: '8px 12px',
    borderRadius: '4px',
  },
  vizConnectionText: {
    fontSize: '12px',
    color: '#bfdbfe',
    lineHeight: '1.5',
  },

  /* Takeaway Box */
  takeawayBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: '#78350f22',
    border: '1px solid #b4530966',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  takeawayTitle: {
    fontSize: '12px',
    color: '#fbbf24',
    display: 'block',
    marginBottom: '2px',
  },
  takeawayText: {
    fontSize: '13px',
    color: '#fef3c7',
    margin: 0,
    lineHeight: '1.5',
  },

  /* Questions */
  questionsCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '14px',
    padding: '24px',
  },
  questionsHeader: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 16px 0',
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  questionItem: {
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  qText: {
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: '1.5',
  },
  qHint: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '6px',
  },

  /* Modal */
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalCard: {
    background: '#18181b',
    border: '1px solid #3b82f6',
    borderRadius: '14px',
    padding: '20px',
    maxWidth: '840px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
  },
  modalBody: {
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
  },
  modalCaption: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    textAlign: 'center',
  },

  /* States */
  loadingBox: {
    background: '#18181b',
    border: '1px dashed #3b82f6',
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyBox: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center',
  },
  legacyMarkdownView: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
  },
  rawMarkdown: {
    color: '#e4e4e7',
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    fontFamily: 'system-ui, sans-serif',
    margin: 0,
  },
};
