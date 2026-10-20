/**
 * BoardSnapshot.jsx
 * Renders a whiteboard or screen snapshot with:
 *  - Extracted text content
 *  - Formatted LaTeX mathematical formulas & equations (rendered via KaTeX)
 *  - Drawn Board Diagram (if detected on the board/slide)
 *  - AI Concept Structure & Architectural Diagram (generates/shows related diagrams,
 *    node-edge flowcharts, formula breakdowns, comparison tables, or trees explaining the concept)
 *  - Key teaching takeaways
 */
import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

function sanitizeSvg(svgContent) {
  if (!svgContent) return '';
  return DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true, svgFilters: true } });
}

/* ── KaTeX Loader ────────────────────────────────────────────────────────── */
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

/* ── Formula Renderer ────────────────────────────────────────────────────── */
function FormulaRenderer({ latex, block = true }) {
  const ref = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const clean = (latex || '')
      .replace(/^\$+/, '').replace(/\$+$/, '')
      .trim();
    if (!clean) return;

    ensureKatex(() => {
      if (!ref.current || !window.katex) return;
      try {
        window.katex.render(clean, ref.current, {
          throwOnError: false,
          displayMode: block,
          output: 'html',
        });
        setError(null);
      } catch (e) {
        setError(clean);
      }
    });
  }, [latex, block]);

  if (error) {
    return (
      <code style={{ fontFamily: 'monospace', fontSize: '13px', color: '#4ade80', background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>
        {error}
      </code>
    );
  }
  return (
    <span
      ref={ref}
      style={{
        display: block ? 'block' : 'inline',
        textAlign: block ? 'center' : 'left',
        padding: block ? '6px 0' : '0',
        overflowX: 'auto',
      }}
    />
  );
}

/* ── Diagram Icons ───────────────────────────────────────────────────────── */
const DIAGRAM_ICONS = {
  flowchart: '⚡ Flowchart',
  state_machine: '🔄 State Machine',
  graph: '📈 Graph',
  tree: '🌳 Tree Hierarchy',
  circuit: '🔌 Circuit Diagram',
  table: '📊 Comparison Table',
  timeline: '⏱️ Timeline',
  venn: '⭕ Venn Diagram',
  coordinate_system: '📉 Coordinate System',
  architecture: '🏗️ System Architecture',
  ER_diagram: '🗄️ ER Diagram',
  UML: '🔷 UML Structure',
  formula_breakdown: '🧮 Formula Breakdown',
  process: '➡️ Process Flow',
  cycle: '🔁 Cycle / Loop',
  stack: '🥞 Layered Stack',
  concept_map: '🧠 Concept Map',
  other: '📐 Diagram',
};

const NODE_TYPE_STYLES = {
  start: { bg: '#10b98122', border: '#10b981', color: '#6ee7b7' },
  end: { bg: '#ef444422', border: '#ef4444', color: '#fca5a5' },
  decision: { bg: '#f59e0b22', border: '#f59e0b', color: '#fcd34d' },
  process: { bg: '#3b82f622', border: '#3b82f6', color: '#93c5fd' },
  highlight: { bg: '#8b5cf622', border: '#8b5cf6', color: '#c4b5fd' },
  data: { bg: '#06b6d422', border: '#06b6d4', color: '#67e8f9' },
  note: { bg: '#27272a', border: '#52525b', color: '#e4e4e7' },
};

/* ── Conceptual Diagram Visualizer Component ────────────────────────────── */
function ConceptDiagramVisualizer({ conceptDiagram, mainConcept }) {
  if (!conceptDiagram || (!conceptDiagram.title && !conceptDiagram.nodes?.length && !conceptDiagram.table?.headers?.length && !conceptDiagram.formulaBreakdown?.parts?.length)) {
    return null;
  }

  const {
    diagramType = 'concept_map',
    title,
    description,
    nodes = [],
    edges = [],
    table,
    formulaBreakdown,
    keyInsight,
  } = conceptDiagram;

  const typeLabel = DIAGRAM_ICONS[diagramType] || `📐 ${diagramType.replace(/_/g, ' ')}`;

  return (
    <div style={S.conceptDiagramCard}>
      {/* Header */}
      <div style={S.conceptDiagramHeader}>
        <div>
          <div style={S.conceptTypeBadge}>{typeLabel}</div>
          <h4 style={S.conceptDiagramTitle}>{title || mainConcept || 'Conceptual Structure'}</h4>
        </div>
      </div>

      {description && <p style={S.conceptDiagramDesc}>{description}</p>}

      {/* 1. Node & Edge Flow Chart / Tree / Process */}
      {nodes.length > 0 && (
        <div style={S.nodeFlowContainer}>
          <div style={S.nodeGrid}>
            {nodes.map((node, i) => {
              const nodeTheme = NODE_TYPE_STYLES[node.type] || NODE_TYPE_STYLES.process;
              // Find outgoing edges from this node
              const outgoing = edges.filter((e) => e.from === node.id);

              return (
                <div key={node.id || i} style={S.nodeCardWrapper}>
                  <div
                    style={{
                      ...S.nodeBox,
                      background: nodeTheme.bg,
                      borderColor: nodeTheme.border,
                      color: nodeTheme.color,
                    }}
                  >
                    <div style={S.nodeLabel}>{node.label || node.id}</div>
                    {node.detail && <div style={S.nodeDetail}>{node.detail}</div>}
                  </div>

                  {outgoing.length > 0 && (
                    <div style={S.edgeContainer}>
                      {outgoing.map((e, ei) => (
                        <div key={ei} style={S.edgeBadge}>
                          <span style={S.edgeArrow}>↓</span>
                          {e.label && <span style={S.edgeLabel}>{e.label}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Formula Breakdown (Variable mapping) */}
      {formulaBreakdown && formulaBreakdown.parts && formulaBreakdown.parts.length > 0 && (
        <div style={S.breakdownContainer}>
          <div style={S.subHeaderLabel}>🧮 Variable-by-Variable Breakdown:</div>
          {formulaBreakdown.formula && (
            <div style={S.formulaHighlight}>
              <FormulaRenderer latex={formulaBreakdown.formula} block={true} />
            </div>
          )}
          <div style={S.variableGrid}>
            {formulaBreakdown.parts.map((p, idx) => (
              <div key={idx} style={S.varCard}>
                <div style={S.varSymbolBox}>
                  <code>{p.symbol}</code>
                </div>
                <div style={S.varInfo}>
                  <div style={S.varMeaning}>{p.meaning}</div>
                  {p.unit && <div style={S.varUnit}>Unit: <span style={{ color: '#38bdf8' }}>{p.unit}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Structured Comparison Table */}
      {table && table.headers && table.headers.length > 0 && (
        <div style={S.tableContainer}>
          <div style={S.subHeaderLabel}>📊 Comparative Breakdown:</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.compTable}>
              <thead>
                <tr>
                  {table.headers.map((h, hi) => (
                    <th key={hi} style={S.compTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows?.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#18181b' : '#1e1e24' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={S.compTd}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Core Insight Callout */}
      {keyInsight && (
        <div style={S.keyInsightBox}>
          <span style={{ fontSize: '15px' }}>💡</span>
          <div>
            <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '2px' }}>
              CORE TAKEAWAY:
            </strong>
            <span style={{ fontSize: '12px', color: '#fef3c7', lineHeight: '1.4' }}>{keyInsight}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main BoardSnapshot component (Full View) ────────────────────────────── */
export function BoardSnapshot({ snapshot, onJumpTimestamp }) {
  if (!snapshot) return null;

  const [activeView, setActiveView] = useState('all'); // 'all' | 'board' | 'concept'
  const [showImageZoom, setShowImageZoom] = useState(false);

  const rawImg = snapshot.image_path || snapshot.imagePath || snapshot.imageBase64 || '';
  let imageUrl = null;
  if (rawImg) {
    if (rawImg.startsWith('data:') || rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
      imageUrl = rawImg;
    } else {
      const filename = rawImg.split(/[/\\]/).pop();
      const apiBase = import.meta.env.VITE_API_URL || '';
      imageUrl = `${apiBase}/snapshots/${filename}`;
    }
  }

  const extractedText = snapshot.extractedText || snapshot.extracted_text || '';
  const diagDesc = snapshot.diagramDescription || snapshot.diagram_description || '';
  const timestamp = snapshot.timestamp || 0;

  const equations = Array.isArray(snapshot.equations) ? snapshot.equations : [];
  const diagram = snapshot.diagram && typeof snapshot.diagram === 'object' ? snapshot.diagram : null;
  const keyPoints = Array.isArray(snapshot.keyPoints) ? snapshot.keyPoints : [];
  const conceptDiagram = snapshot.conceptDiagram || null;
  const mainConcept = snapshot.mainConcept || snapshot.main_concept || '';

  const structuredItems = Array.isArray(snapshot.extractedContent)
    ? snapshot.extractedContent
    : Array.isArray(snapshot.structuredContent)
    ? snapshot.structuredContent
    : [];

  const slideTitle = snapshot.slideTitle || snapshot.slide_title || '';
  const codeSnippet = snapshot.codeSnippet || snapshot.code_snippet || '';
  const codeLanguage = snapshot.codeLanguage || snapshot.code_language || '';
  const legacyEquation = snapshot.equation || '';

  const hasEquations = equations.length > 0 || (legacyEquation && equations.length === 0);
  const hasDrawnDiagram = (diagram && diagram.type && diagram.type !== 'none') || diagDesc;
  const hasConceptDiagram = Boolean(conceptDiagram && (conceptDiagram.title || conceptDiagram.nodes?.length));
  const hasStructuredVisuals = structuredItems.some((it) => it && it.svg);
  const hasCode = !!codeSnippet;
  const hasKeyPoints = keyPoints.length > 0;

  return (
    <div style={S.card}>
      {/* ── Header ── */}
      <div style={S.cardHeader}>
        <div style={S.headerLeft}>
          {slideTitle ? (
            <span style={S.slideTitle}>{slideTitle}</span>
          ) : mainConcept ? (
            <span style={S.conceptTag}>📌 {mainConcept}</span>
          ) : (
            <span style={S.slideTitle}>Whiteboard Capture</span>
          )}
        </div>
        <button
          onClick={() => onJumpTimestamp && onJumpTimestamp(timestamp)}
          style={S.tsBtn}
          title="Jump to video timestamp"
        >
          ⏱️ {formatTime(timestamp)}
        </button>
      </div>

      {/* ── Original Captured Image Frame ── */}
      {imageUrl && (
        <div style={S.imageSection}>
          <div style={S.imageHeader}>
            <span style={S.imageTag}>📸 Board / Slide Frame Capture</span>
            <button
              onClick={() => setShowImageZoom(true)}
              style={S.zoomBtn}
              title="Click to enlarge image"
            >
              🔍 Enlarge View
            </button>
          </div>
          <div style={S.imageWrapper} onClick={() => setShowImageZoom(true)}>
            <img
              src={imageUrl}
              alt={slideTitle || mainConcept || 'Board snapshot'}
              style={S.snapshotImg}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      {showImageZoom && imageUrl && (
        <div style={S.modalOverlay} onClick={() => setShowImageZoom(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h4 style={S.modalTitle}>🔍 {slideTitle || mainConcept || 'Whiteboard Frame Snapshot'}</h4>
              <button onClick={() => setShowImageZoom(false)} style={S.modalCloseBtn}>✕</button>
            </div>
            <div style={S.modalBody}>
              <img
                src={imageUrl}
                alt="Enlarged snapshot"
                style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── View Toggle Bar (if both drawn & conceptual diagrams exist) ── */}
      {hasDrawnDiagram && hasConceptDiagram && (
        <div style={S.tabBar}>
          <button
            onClick={() => setActiveView('all')}
            style={S.tabBtn(activeView === 'all')}
          >
            📋 Complete View
          </button>
          <button
            onClick={() => setActiveView('board')}
            style={S.tabBtn(activeView === 'board')}
          >
            ✏️ Board Capture
          </button>
          <button
            onClick={() => setActiveView('concept')}
            style={S.tabBtn(activeView === 'concept')}
          >
            🧠 AI Concept Diagram
          </button>
        </div>
      )}

      {/* ── 1. Extracted Plain Text ── */}
      {(activeView === 'all' || activeView === 'board') && extractedText && (
        <div style={S.section}>
          <div style={S.sectionLabel}>📝 Extracted Board Content</div>
          <div style={S.textBlock}>{extractedText}</div>
        </div>
      )}

      {/* ── 2. Formulas & Equations ── */}
      {(activeView === 'all' || activeView === 'board') && hasEquations && (
        <div style={S.section}>
          <div style={S.sectionLabel}>📐 Mathematical Expressions & Formulas</div>
          {equations.length > 0 ? (
            equations.map((eq, i) => (
              <div key={i} style={S.eqCard}>
                <div style={S.eqHeader}>
                  <span style={S.eqName}>{eq.name || `Formula ${i + 1}`}</span>
                </div>
                <div style={S.eqDisplay}>
                  <FormulaRenderer latex={eq.latex} block={true} />
                </div>
                {eq.description && <div style={S.eqDesc}>💡 {eq.description}</div>}
              </div>
            ))
          ) : legacyEquation ? (
            <div style={S.eqCard}>
              <div style={S.eqDisplay}>
                <FormulaRenderer latex={legacyEquation} block={true} />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── 3. Code Snippet ── */}
      {hasCode && (
        <div style={S.section}>
          <div style={S.sectionLabel}>💻 Code Snippet{codeLanguage ? ` (${codeLanguage})` : ''}</div>
          <pre style={S.codeBlock}>{codeSnippet}</pre>
        </div>
      )}

      {/* ── 3.5. AI-Generated Educational Diagrams & Graphs (Deterministic SVGs) ── */}
      {hasStructuredVisuals && (
        <div style={S.section}>
          <div style={S.sectionLabel}>📈 AI Generated Concept Diagrams & Graphs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {structuredItems
              .filter((it) => it && it.svg)
              .map((it, ii) => (
                <div key={ii} style={S.diagramCard}>
                  {it.content && (
                    <div style={{ ...S.diagramTitle, color: '#38bdf8' }}>
                      {it.visualizationType === 'coordinate_graph' ? '📈 Plot:' : '⚡ Flow:'} {it.content}
                    </div>
                  )}
                  {/* Render the deterministic SVG */}
                  <div
                    style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', margin: '8px 0' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(it.svg) }}
                  />
                  {it.explanation && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', marginTop: '6px' }}>
                      💡 <strong>Concept Explanation:</strong> {it.explanation}
                    </div>
                  )}
                  {it.visualizationDescription && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                      Figure Note: {it.visualizationDescription}
                    </div>
                  )}
                  {it.takeaway && (
                    <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '6px' }}>
                      📌 <strong>Takeaway:</strong> {it.takeaway}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── 4. Actual Drawn Diagram from Board/Slide ── */}
      {(activeView === 'all' || activeView === 'board') && hasDrawnDiagram && (
        <div style={S.section}>
          <div style={S.sectionLabel}>
            ✏️ Drawn Diagram on Board
            {diagram?.type && diagram.type !== 'none' ? ` (${diagram.type.replace(/_/g, ' ')})` : ''}
          </div>

          <div style={S.diagramCard}>
            {diagram?.title && <div style={S.diagramTitle}>{diagram.title}</div>}
            <div style={S.diagramDesc}>{diagram?.description || diagDesc}</div>

            {Array.isArray(diagram?.steps) && diagram.steps.length > 0 && (
              <div style={S.stepsWrap}>
                {diagram.steps.map((step, si) => (
                  <React.Fragment key={si}>
                    <div style={S.stepNode}>{step}</div>
                    {si < diagram.steps.length - 1 && (
                      <div style={S.stepArrow}>↓</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {diagram?.axes && <div style={S.axesLabel}>Axes: {diagram.axes}</div>}
          </div>
        </div>
      )}

      {/* ── 5. AI Concept Structure & Architectural Diagram ── */}
      {(activeView === 'all' || activeView === 'concept') && hasConceptDiagram && (
        <div style={S.section}>
          <div style={S.sectionLabel}>
            🧠 Related Concept Diagram & Architectural Structure
          </div>
          <ConceptDiagramVisualizer
            conceptDiagram={conceptDiagram}
            mainConcept={mainConcept}
          />
        </div>
      )}

      {/* ── 6. Key Points ── */}
      {(activeView === 'all' || activeView === 'board') && hasKeyPoints && (
        <div style={S.section}>
          <div style={S.sectionLabel}>🎯 Key Takeaways</div>
          <ul style={S.keyPointsList}>
            {keyPoints.map((pt, i) => (
              <li key={i} style={S.keyPoint}>{pt}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Compact Version for Live Room Sidebar ───────────────────────────────── */
export function BoardSnapshotCompact({ snapshot, onJumpTimestamp }) {
  if (!snapshot) return null;

  const [showConcept, setShowConcept] = useState(false);

  const extractedText = snapshot.extractedText || snapshot.extracted_text || '';
  const equations = Array.isArray(snapshot.equations) ? snapshot.equations : [];
  const legacyEquation = snapshot.equation || '';
  const diagram = snapshot.diagram && typeof snapshot.diagram === 'object' ? snapshot.diagram : null;
  const diagDesc = snapshot.diagramDescription || snapshot.diagram_description || '';
  const conceptDiagram = snapshot.conceptDiagram || null;
  const mainConcept = snapshot.mainConcept || snapshot.main_concept || '';
  const timestamp = snapshot.timestamp || 0;
  const slideTitle = snapshot.slideTitle || snapshot.slide_title || '';

  const structuredItems = Array.isArray(snapshot.extractedContent)
    ? snapshot.extractedContent
    : Array.isArray(snapshot.structuredContent)
    ? snapshot.structuredContent
    : [];

  const hasConcept = Boolean(conceptDiagram && (conceptDiagram.title || conceptDiagram.nodes?.length));

  return (
    <div style={SC.card}>
      <div style={SC.header}>
        <span style={SC.ts}>⏱️ {formatTime(timestamp)}</span>
        {mainConcept ? (
          <span style={SC.conceptBadge}>📌 {mainConcept}</span>
        ) : slideTitle ? (
          <span style={SC.slideTag}>{slideTitle}</span>
        ) : null}
      </div>

      {extractedText && <div style={SC.text}>{extractedText}</div>}

      {(equations.length > 0 || legacyEquation) && (
        <div style={SC.eqWrap}>
          {equations.length > 0 ? (
            equations.map((eq, i) => (
              <div key={i} style={SC.eqCard}>
                <div style={SC.eqLabel}>{eq.name || `Formula ${i + 1}`}</div>
                <FormulaRenderer latex={eq.latex} block={true} />
                {eq.description && <div style={SC.eqDesc}>{eq.description}</div>}
              </div>
            ))
          ) : (
            <div style={SC.eqCard}>
              <FormulaRenderer latex={legacyEquation} block={true} />
            </div>
          )}
        </div>
      )}

      {/* Generated SVG Graphs & Diagrams in live room sidebar */}
      {structuredItems.some((it) => it && it.svg) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {structuredItems
            .filter((it) => it && it.svg)
            .map((it, ii) => (
              <div key={ii} style={SC.diagCard}>
                <div style={SC.diagLabel}>📈 {it.content || 'Generated Visualization'}</div>
                <div
                  style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', margin: '4px 0' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(it.svg) }}
                />
                {it.explanation && <div style={SC.diagDesc}>{it.explanation}</div>}
              </div>
            ))}
        </div>
      )}

      {/* Drawn diagram note */}
      {diagram && diagram.type && diagram.type !== 'none' && (
        <div style={SC.diagCard}>
          <div style={SC.diagLabel}>
            ✏️ {diagram.type.replace(/_/g, ' ')} {diagram.title ? `– ${diagram.title}` : ''}
          </div>
          {diagram.description && <div style={SC.diagDesc}>{diagram.description}</div>}
          {Array.isArray(diagram.steps) && diagram.steps.length > 0 && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              {diagram.steps.join(' → ')}
            </div>
          )}
        </div>
      )}

      {!diagram && diagDesc && (
        <div style={SC.diagCard}>
          <div style={SC.diagLabel}>✏️ Drawn Diagram</div>
          <div style={SC.diagDesc}>{diagDesc}</div>
        </div>
      )}

      {/* Concept Diagram Toggle in Sidebar */}
      {hasConcept && (
        <div style={{ marginTop: '4px' }}>
          <button
            onClick={() => setShowConcept(!showConcept)}
            style={SC.toggleConceptBtn}
          >
            {showConcept ? '🔼 Hide Concept Diagram' : '🧠 View Related Concept Diagram & Breakdown'}
          </button>
          {showConcept && (
            <div style={{ marginTop: '8px' }}>
              <ConceptDiagramVisualizer
                conceptDiagram={conceptDiagram}
                mainConcept={mainConcept}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ══════════════════════════════════════════════════════════════
   STYLES – Full PostLectureHub View
══════════════════════════════════════════════════════════════ */
const S = {
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#1e1e24',
    borderBottom: '1px solid #27272a',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  slideTitle: { fontSize: '14px', fontWeight: '700', color: '#fff' },
  conceptTag: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#38bdf8',
    background: '#0284c722',
    border: '1px solid #0284c755',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  tsBtn: {
    background: '#27272a',
    color: '#38bdf8',
    border: '1px solid #38bdf844',
    borderRadius: '5px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tabBar: {
    display: 'flex',
    background: '#141416',
    borderBottom: '1px solid #27272a',
    padding: '0 8px',
    gap: '4px',
  },
  tabBtn: (active) => ({
    background: active ? '#27272a' : 'transparent',
    color: active ? '#38bdf8' : '#71717a',
    border: 'none',
    borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
  }),
  imageSection: {
    padding: '12px 16px 4px 16px',
    background: '#121215',
    borderBottom: '1px solid #27272a',
  },
  imageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  imageTag: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  zoomBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#93c5fd',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  imageWrapper: {
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #334155',
    background: '#090d16',
    cursor: 'zoom-in',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: '260px',
  },
  snapshotImg: {
    width: '100%',
    height: 'auto',
    maxHeight: '260px',
    objectFit: 'contain',
    display: 'block',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '20px',
  },
  modalCard: {
    background: '#18181b',
    border: '1px solid #38bdf8',
    borderRadius: '14px',
    padding: '18px',
    maxWidth: '920px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '15px',
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
  section: {
    padding: '14px 16px',
    borderBottom: '1px solid #27272a',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  textBlock: {
    fontSize: '13px',
    color: '#e4e4e7',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    fontFamily: 'system-ui, sans-serif',
  },

  /* Equation */
  eqCard: {
    background: '#09090b',
    border: '1px solid #38bdf833',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '10px',
  },
  eqHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  eqName: { fontSize: '11px', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  eqDisplay: {
    background: '#0f172a',
    borderRadius: '6px',
    padding: '12px',
    overflowX: 'auto',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqDesc: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.5,
    borderTop: '1px solid #1e293b',
    paddingTop: '6px',
  },

  /* Code */
  codeBlock: {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '12px',
    color: '#e6edf3',
    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    overflowX: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.6,
    margin: 0,
  },

  /* Drawn Diagram */
  diagramCard: {
    background: '#0f0f11',
    border: '1px solid #a855f733',
    borderRadius: '8px',
    padding: '14px',
  },
  diagramTitle: { fontSize: '13px', fontWeight: '700', color: '#d8b4fe', marginBottom: '6px' },
  diagramDesc: { fontSize: '13px', color: '#c084fc', lineHeight: 1.6 },
  stepsWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0',
    marginTop: '10px',
  },
  stepNode: {
    background: '#1e1333',
    border: '1px solid #7c3aed',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    color: '#e9d5ff',
    fontWeight: '600',
    maxWidth: '100%',
  },
  stepArrow: {
    fontSize: '18px',
    color: '#7c3aed',
    padding: '2px 0 2px 20px',
    lineHeight: 1,
  },
  axesLabel: { fontSize: '11px', color: '#94a3b8', marginTop: '8px' },

  /* Conceptual Diagram Card */
  conceptDiagramCard: {
    background: 'linear-gradient(135deg, #111827 0%, #0f172a 100%)',
    border: '1px solid #3b82f655',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  conceptDiagramHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  conceptTypeBadge: {
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: '800',
    color: '#60a5fa',
    background: '#2563eb22',
    border: '1px solid #2563eb44',
    padding: '2px 8px',
    borderRadius: '4px',
    marginBottom: '6px',
    textTransform: 'uppercase',
  },
  conceptDiagramTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  conceptDiagramDesc: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.5,
    margin: 0,
  },
  nodeFlowContainer: {
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '14px',
  },
  nodeGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'flex-start',
  },
  nodeCardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  nodeBox: {
    border: '1px solid',
    borderRadius: '6px',
    padding: '8px 12px',
    minWidth: '120px',
    maxWidth: '220px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  nodeLabel: {
    fontSize: '12px',
    fontWeight: '700',
    marginBottom: '2px',
  },
  nodeDetail: {
    fontSize: '10px',
    color: '#94a3b8',
    lineHeight: 1.3,
  },
  edgeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  edgeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  edgeArrow: {
    fontSize: '14px',
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  edgeLabel: {
    fontSize: '9px',
    color: '#93c5fd',
    background: '#1e3a8a44',
    padding: '1px 5px',
    borderRadius: '3px',
  },

  /* Breakdown */
  breakdownContainer: {
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px',
  },
  subHeaderLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#93c5fd',
    marginBottom: '8px',
  },
  formulaHighlight: {
    background: '#0f172a',
    borderRadius: '6px',
    padding: '8px',
    marginBottom: '10px',
  },
  variableGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
  },
  varCard: {
    background: '#181f2f',
    border: '1px solid #1e3a8a55',
    borderRadius: '6px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  varSymbolBox: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#38bdf8',
    background: '#0b1329',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  varInfo: {
    flex: 1,
  },
  varMeaning: {
    fontSize: '11px',
    color: '#e2e8f0',
    fontWeight: '600',
  },
  varUnit: {
    fontSize: '10px',
    color: '#94a3b8',
  },

  /* Comparison Table */
  tableContainer: {
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px',
  },
  compTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  compTh: {
    background: '#1e293b',
    color: '#93c5fd',
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid #334155',
    fontWeight: '700',
  },
  compTd: {
    padding: '8px 10px',
    borderBottom: '1px solid #1e293b',
    color: '#e2e8f0',
  },

  /* Key Insight Box */
  keyInsightBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: '#78350f22',
    border: '1px solid #b4530966',
    borderRadius: '8px',
    padding: '10px 14px',
  },

  /* Key points */
  keyPointsList: { margin: '0', paddingLeft: '18px' },
  keyPoint: { fontSize: '13px', color: '#d4d4d8', lineHeight: 1.7, marginBottom: '2px' },
};

/* ══════════════════════════════════════════════════════════════
   STYLES – Compact Live Room Sidebar
══════════════════════════════════════════════════════════════ */
const SC = {
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  ts: { fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: '600' },
  slideTag: {
    fontSize: '10px', color: '#a1a1aa', background: '#27272a',
    padding: '1px 6px', borderRadius: '4px', maxWidth: '60%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  conceptBadge: {
    fontSize: '10px', color: '#38bdf8', background: '#0284c722',
    border: '1px solid #0284c744', padding: '1px 6px', borderRadius: '4px',
    fontWeight: '600',
  },
  text: { fontSize: '12px', color: '#d4d4d8', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  eqWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  eqCard: {
    background: '#0f172a',
    border: '1px solid #38bdf833',
    borderRadius: '6px',
    padding: '8px 10px',
    overflowX: 'auto',
  },
  eqLabel: { fontSize: '10px', fontWeight: '700', color: '#38bdf8', marginBottom: '4px' },
  eqDesc: { fontSize: '10px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 },
  diagCard: {
    background: '#0f0f11',
    border: '1px solid #a855f733',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  diagLabel: { fontSize: '10px', fontWeight: '700', color: '#c084fc', marginBottom: '4px' },
  diagDesc: { fontSize: '11px', color: '#a855f7', lineHeight: 1.5 },
  toggleConceptBtn: {
    width: '100%',
    background: '#1e293b',
    border: '1px solid #3b82f644',
    color: '#93c5fd',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
};
