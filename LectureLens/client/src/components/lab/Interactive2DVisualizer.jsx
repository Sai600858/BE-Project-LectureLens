import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import Badge from '../Badge';
import Button from '../Button';

function sanitizeSvg(svgContent) {
  if (!svgContent) return '';
  return DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true, svgFilters: true } });
}

export default function Interactive2DVisualizer({ spec, topicTitle, learningObjective, onJumpTimestamp }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showTextAlt, setShowTextAlt] = useState(false);

  const title = spec?.title || topicTitle || '2D Pedagogical Schematic';
  const caption = spec?.caption || '';
  const svg = spec?.svg || null;
  const connectionToFormula = spec?.connectionToFormula || null;
  const type = spec?.type || 'diagram';

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleZoomReset = () => setZoomLevel(1);

  return (
    <div className="w-full flex flex-col gap-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-2xl">
      {/* Visualizer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">📐</span>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 capitalize">Deterministic 2D Schematic • Type: {type.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTextAlt((prev) => !prev)}
            aria-pressed={showTextAlt}
          >
            {showTextAlt ? '👁️ Show Graphic' : '📋 Text Inspector'}
          </Button>

          <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700/60">
            <button
              onClick={handleZoomOut}
              className="px-2.5 py-1 text-slate-300 hover:text-white text-xs font-bold rounded hover:bg-slate-700"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="px-2 text-xs font-mono text-cyan-400">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="px-2.5 py-1 text-slate-300 hover:text-white text-xs font-bold rounded hover:bg-slate-700"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 text-slate-400 hover:text-white text-xs rounded hover:bg-slate-700 ml-1"
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Visual Display or Tabular Inspector */}
      {!showTextAlt ? (
        <div className="relative w-full min-h-[380px] bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-center overflow-auto p-4">
          {svg ? (
            <div
              className="transition-transform duration-200 origin-center"
              style={{ transform: `scale(${zoomLevel})` }}
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <span className="text-4xl mb-3">📊</span>
              <p className="text-sm font-semibold text-slate-300">Deterministic 2D Specification Active</p>
              <p className="text-xs text-slate-500 max-w-md mt-1">{caption || 'Structured 2D geometric schematic aligned with this lecture section.'}</p>
            </div>
          )}
        </div>
      ) : (
        /* Accessible Tabular State Inspector */
        <div className="w-full bg-slate-950/80 rounded-xl border border-slate-800 p-6 flex flex-col gap-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <span>♿ Accessible Pedagogical Summary</span>
          </div>
          <table className="w-full text-left border-collapse">
            <tbody>
              <tr className="border-b border-slate-800">
                <th className="py-2.5 pr-4 text-slate-400 font-medium w-1/4">Topic</th>
                <td className="py-2.5 text-white font-semibold">{topicTitle}</td>
              </tr>
              <tr className="border-b border-slate-800">
                <th className="py-2.5 pr-4 text-slate-400 font-medium">Modality</th>
                <td className="py-2.5 text-cyan-300">Category B: Deterministic 2D Schematic</td>
              </tr>
              <tr className="border-b border-slate-800">
                <th className="py-2.5 pr-4 text-slate-400 font-medium">Learning Objective</th>
                <td className="py-2.5">{learningObjective || 'Visualizes structural flow and formula mechanics.'}</td>
              </tr>
              {caption && (
                <tr className="border-b border-slate-800">
                  <th className="py-2.5 pr-4 text-slate-400 font-medium">Figure Description</th>
                  <td className="py-2.5 text-slate-300">{caption}</td>
                </tr>
              )}
              {connectionToFormula && (
                <tr>
                  <th className="py-2.5 pr-4 text-slate-400 font-medium">Formula / Code Link</th>
                  <td className="py-2.5 text-amber-300">{connectionToFormula}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Caption & Pedagogical Grounding Callout */}
      {caption && (
        <p className="text-xs text-slate-400 italic bg-slate-800/40 p-3 rounded-lg border border-slate-800">
          <strong className="text-slate-300 not-italic">Figure Annotation:</strong> {caption}
        </p>
      )}

      {connectionToFormula && (
        <div className="flex items-start gap-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-4 text-xs text-cyan-200">
          <span className="text-base shrink-0">🔗</span>
          <div>
            <strong className="font-semibold block text-cyan-100 mb-0.5">How this visual explains the concept:</strong>
            {connectionToFormula}
          </div>
        </div>
      )}
    </div>
  );
}
