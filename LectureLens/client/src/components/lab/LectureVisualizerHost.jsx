import React, { useState, useEffect, lazy, Suspense } from 'react';
import Badge from '../Badge';
import Button from '../Button';
import Interactive2DVisualizer from './Interactive2DVisualizer';
import { getVisualizer } from '../../services/visualizationRegistry';
import { isWebGLAvailable } from '../../utils/webglSupport';

const DistributedConsensus3D = lazy(() => import('./DistributedConsensus3D'));
const AvlTree3D = lazy(() => import('./AvlTree3D'));
const NeuralNetwork3D = lazy(() => import('./NeuralNetwork3D'));

export default function LectureVisualizerHost({
  lectureId,
  lectureTitle,
  visualization,
  onJumpTimestamp,
  onReturnToLecture,
}) {
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);

  if (!visualization) {
    return (
      <div className="w-full bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center flex flex-col items-center justify-center gap-3">
        <span className="text-4xl">🔬</span>
        <h3 className="text-lg font-bold text-white">No Topic Selected</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Please select an eligible topic from this lecture to launch its tailored visual experience.
        </p>
      </div>
    );
  }

  const {
    topicId,
    topicTitle,
    visualizationType,
    visualizerId,
    suitabilityCategory,
    learningObjective,
    suitabilityRationale,
    sourceTranscriptSegments = [],
    grounding = {},
    instructions = [],
    spec = {},
  } = visualization;

  const visualizerDef = getVisualizer(visualizerId);

  // Render Category C (Conventional Study Material)
  if (visualizationType === 'CONVENTIONAL' || suitabilityCategory === 'CATEGORY_C') {
    return (
      <div className="w-full bg-slate-900/60 rounded-2xl border border-slate-800 p-8 flex flex-col gap-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">{topicTitle}</h3>
              <p className="text-xs text-slate-400">Lecture: {lectureTitle || 'Current Session'}</p>
            </div>
          </div>
          <Badge variant="neutral">Conventional Learning Material</Badge>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col gap-3">
          <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>✅ Pedagogical Suitability Decision</span>
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            {suitabilityRationale ||
              'This concept consists of fundamental theoretical principles, definitions, and analytical reasoning. It is best mastered through structured notes, mathematical derivations, and review questions without forced or distracting 3D decorations.'}
          </p>
          {learningObjective && (
            <div className="text-xs text-slate-400 border-t border-slate-700/50 pt-3 mt-1">
              <strong className="text-slate-300">Target Objective:</strong> {learningObjective}
            </div>
          )}
        </div>

        {onReturnToLecture && (
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={onReturnToLecture}>
              ← Jump to Study Notes
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      key={`${lectureId}_${topicId}`}
      className="w-full flex flex-col gap-6"
    >
      {/* ── Context & Grounding Header Bar ───────────────────────────────── */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 flex flex-col gap-4 backdrop-blur-md shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={visualizationType === '3D' ? 'cyan' : 'emerald'}>
                {visualizationType === '3D' ? '⚡ 3D Interactive Simulation' : '📐 2D Deterministic Diagram'}
              </Badge>
              {visualizerDef && (
                <Badge variant="neutral" size="sm">
                  Module: {visualizerDef.name}
                </Badge>
              )}
              {lectureTitle && (
                <span className="text-xs text-slate-400 font-medium">
                  Lecture: <strong className="text-slate-300">{lectureTitle}</strong>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              {topicTitle}
            </h2>

            {learningObjective && (
              <p className="text-sm text-cyan-200/90 leading-relaxed bg-cyan-950/20 border border-cyan-800/30 rounded-xl p-3.5 mt-2">
                <strong className="text-cyan-300 font-semibold block mb-0.5">🎯 Core Learning Objective:</strong>
                {learningObjective}
              </p>
            )}
          </div>

          {onReturnToLecture && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReturnToLecture}
              className="shrink-0"
              aria-label="Return to full lecture study suite"
            >
              ← Back to Lecture Hub
            </Button>
          )}
        </div>

        {/* ── Evidence & Timestamp Grounding Links ─────────────────────────── */}
        {sourceTranscriptSegments.length > 0 && (
          <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎙️</span> Lecture Evidence & Grounded Timestamps:
            </span>
            <div className="flex flex-wrap gap-2">
              {sourceTranscriptSegments.map((seg, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => onJumpTimestamp && onJumpTimestamp(seg.timestamp)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer group"
                  title="Click to jump playback and transcript to this timestamp"
                >
                  <span className="font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                    ⏱️ {seg.formattedTime || '0:00'}
                  </span>
                  <span className="truncate max-w-[280px] text-slate-400 group-hover:text-slate-200">
                    "{seg.text}"
                  </span>
                  <span className="text-[10px] text-cyan-400 font-bold ml-1">Jump →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Guided Exploration Instructions & Assumptions ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
          {instructions.length > 0 && (
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60 flex flex-col gap-1.5">
              <strong className="text-amber-300 font-bold flex items-center gap-1.5">
                <span>⚡</span> Guided "What-If" Exploration Steps:
              </strong>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                {instructions.map((inst, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {inst}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60 flex flex-col gap-1.5">
            <strong className="text-slate-200 font-bold flex items-center gap-1.5">
              <span>🛡️</span> Pedagogical Grounding & Limitations:
            </strong>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-slate-300">Lecture Grounding:</strong>{' '}
              {grounding.lectureEvidence || 'Directly aligned with instructional lecture topics.'}
            </p>
            {grounding.simulationAssumptions && (
              <p className="text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Simulation Assumptions:</strong>{' '}
                {grounding.simulationAssumptions}
              </p>
            )}
            {grounding.limitations && (
              <p className="text-slate-500 leading-relaxed italic">
                <strong>Scope Note:</strong> {grounding.limitations}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Hardware WebGL Notice ────────────────────────────────────────── */}
      {visualizationType === '3D' && !webglSupported && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">⚠️</span>
          <div>
            <strong className="font-semibold block mb-0.5">Hardware WebGL Acceleration Unavailable</strong>
            Your browser environment does not support 3D WebGL rendering. The visualizer below has fallen back to the accessible tabular state inspection mode, showing all algorithmic calculations and state transitions without loss of educational fidelity.
          </div>
        </div>
      )}

      {/* ── Primary Visualizer Stage (Isolated by Topic) ──────────────────── */}
      <div className="w-full">
        <Suspense fallback={
          <div className="w-full bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <p className="text-sm text-cyan-300 font-semibold">Loading 3D Interactive Simulation Module...</p>
          </div>
        }>
          {visualizationType === '3D' && visualizerId === 'raft' && (
            <DistributedConsensus3D key={`raft_${topicId}`} />
          )}

          {visualizationType === '3D' && visualizerId === 'avl' && (
            <AvlTree3D key={`avl_${topicId}`} />
          )}

          {visualizationType === '3D' && visualizerId === 'neural' && (
            <NeuralNetwork3D key={`neural_${topicId}`} />
          )}
        </Suspense>

        {visualizationType === '2D' && (
          <Interactive2DVisualizer
            key={`2d_${topicId}`}
            spec={spec}
            topicTitle={topicTitle}
            learningObjective={learningObjective}
            onJumpTimestamp={onJumpTimestamp}
          />
        )}
      </div>
    </div>
  );
}
