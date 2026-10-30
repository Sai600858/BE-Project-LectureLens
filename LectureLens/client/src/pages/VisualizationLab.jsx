import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Button from '../components/Button';
import LectureVisualizerHost from '../components/lab/LectureVisualizerHost';
import { VISUALIZER_REGISTRY, getVisualizer } from '../services/visualizationRegistry';

const DistributedConsensus3D = lazy(() => import('../components/lab/DistributedConsensus3D'));
const AvlTree3D = lazy(() => import('../components/lab/AvlTree3D'));
const NeuralNetwork3D = lazy(() => import('../components/lab/NeuralNetwork3D'));
import { lectureApi, aiApi } from '../services/api';
import { isWebGLAvailable } from '../utils/webglSupport';

export default function VisualizationLab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query Params for Lecture-Specific Grounding
  const queryLectureId = searchParams.get('lectureId');
  const queryTopicId = searchParams.get('topicId');
  const queryModule = searchParams.get('module') || 'raft';

  // Mode: 'lecture' if lectureId is provided, otherwise 'catalog'
  const [activeTab, setActiveTab] = useState(queryLectureId ? 'lecture' : 'catalog');
  const [selectedLectureId, setSelectedLectureId] = useState(queryLectureId || '');
  const [lecturesList, setLecturesList] = useState([]);
  const [lectureManifest, setLectureManifest] = useState(null);
  const [activeTopicId, setActiveTopicId] = useState(queryTopicId || '');
  const [activeCatalogModule, setActiveCatalogModule] = useState(queryModule);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [webglSupported, setWebglSupported] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);

  // Fetch recorded lectures list for the selector
  useEffect(() => {
    lectureApi.getLectures()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.lectures || [];
        setLecturesList(list);
      })
      .catch((err) => console.warn('Could not fetch lectures list:', err));
  }, []);

  // Load lecture-specific visualization manifest whenever selectedLectureId changes
  useEffect(() => {
    if (!selectedLectureId) {
      setLectureManifest(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError('');

    aiApi.getLectureVisualizations(selectedLectureId)
      .then((data) => {
        if (!isMounted) return;
        setLectureManifest(data);
        // Default to queryTopicId, or first recommended visualizer, or first topic
        if (queryTopicId && data.topics?.some((t) => t.topicId === queryTopicId)) {
          setActiveTopicId(queryTopicId);
        } else if (data.recommendedVisualizations?.length > 0) {
          setActiveTopicId(data.recommendedVisualizations[0].topicId);
        } else if (data.topics?.length > 0) {
          setActiveTopicId(data.topics[0].topicId);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err.response?.data?.error || err.message || 'Could not load lecture visualization manifest.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedLectureId, queryTopicId]);

  // Handle switching lectures
  const handleSelectLecture = (lecId) => {
    setSelectedLectureId(lecId);
    setActiveTopicId('');
    if (lecId) {
      setActiveTab('lecture');
      setSearchParams({ lectureId: lecId });
    } else {
      setActiveTab('catalog');
      setSearchParams({ module: activeCatalogModule });
    }
  };

  // Handle selecting a topic within the lecture
  const handleSelectTopic = (topId) => {
    setActiveTopicId(topId);
    setSearchParams({ lectureId: selectedLectureId, topicId: topId });
  };

  // Handle catalog module selection
  const handleSelectCatalogModule = (modId) => {
    setActiveCatalogModule(modId);
    setSearchParams({ module: modId });
  };

  // Resolve current active visualization object for the selected lecture and topic
  const activeLectureViz = useMemo(() => {
    if (!lectureManifest) return null;

    if (lectureManifest.recommendedVisualizations?.length > 0) {
      if (activeTopicId) {
        const found = lectureManifest.recommendedVisualizations.find((v) => v.topicId === activeTopicId);
        if (found) return found;
      }
      return lectureManifest.recommendedVisualizations[0];
    }

    if (lectureManifest.topics?.length > 0) {
      const top = lectureManifest.topics.find((t) => t.topicId === activeTopicId) || lectureManifest.topics[0];
      return {
        topicId: top.topicId,
        topicTitle: top.topicTitle,
        lectureId: selectedLectureId,
        visualizationType: 'CONVENTIONAL',
        suitabilityCategory: 'CATEGORY_C',
        learningObjective: top.learningObjective,
        suitabilityRationale: top.reasoning,
        grounding: {
          lectureEvidence: `Curriculum topic: ${top.topicTitle}`,
        },
      };
    }

    return null;
  }, [lectureManifest, activeTopicId, selectedLectureId]);

  const currentCatalogDef = getVisualizer(activeCatalogModule) || VISUALIZER_REGISTRY.raft;

  return (
    <div className="min-h-screen bg-surface-base text-text-primary flex flex-col selection:bg-cyan-500/20 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* ── Top Header ────────────────────────────────────────────────────── */}
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-6">
          <div className="flex flex-col gap-2">
            <div className="editorial-eyebrow">
              <span className="eyebrow-num">🔬</span>
              <span>INTERACTIVE SIMULATIONS</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
                Interactive Simulations Lab
              </h1>
            </div>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
              Explore spatial 3D models and interactive 2D diagrams designed to make abstract computer science, mathematics, and algorithmic concepts intuitive.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedLectureId ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/lecture/${selectedLectureId}/review`)}
                aria-label="Return to lecture workspace"
              >
                ← Return to Lecture Workspace
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                aria-label="Return to Dashboard"
              >
                ← Back to Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* ── Navigation / Mode Switcher ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('lecture');
                if (!selectedLectureId && lecturesList.length > 0) {
                  handleSelectLecture(lecturesList[0].id || lecturesList[0].lectureId);
                }
              }}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'lecture' ? '700' : '600',
                border: activeTab === 'lecture' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: activeTab === 'lecture' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: activeTab === 'lecture' ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.18s',
              }}
            >
              <span>Explore by Lecture</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('catalog');
                setSearchParams({ module: activeCatalogModule });
              }}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'catalog' ? '700' : '600',
                border: activeTab === 'catalog' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: activeTab === 'catalog' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: activeTab === 'catalog' ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.18s',
              }}
            >
              <span>All Simulations</span>
            </button>
          </div>

          {/* Lecture Selector Dropdown */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Active Lecture:</span>
            <select
              value={selectedLectureId}
              onChange={(e) => handleSelectLecture(e.target.value)}
              className="bg-surface-base border border-border-subtle rounded-xl px-3 py-1.5 text-xs sm:text-sm text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 max-w-[260px] truncate"
              aria-label="Select recorded lecture"
            >
              <option value="">— Select a Lecture —</option>
              {lecturesList.map((lec) => {
                const id = lec.id || lec.lectureId;
                return (
                  <option key={id} value={id}>
                    {lec.title || 'Untitled Lecture'} ({lec.room_id || 'ID: ' + id.slice(0, 8)})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* ── WebGL Support Fallback Notice ─────────────────────────────────── */}
        {!webglSupported && (
          <div
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm flex items-start gap-3"
            role="alert"
          >
            <span className="text-xl" aria-hidden="true">⚠️</span>
            <div>
              <strong className="font-semibold block mb-0.5">Hardware WebGL Acceleration Unavailable</strong>
              Your current environment does not support 3D WebGL rendering. The visualizer below automatically provides full accessible tabular and textual state inspection modes, ensuring zero educational loss.
            </div>
          </div>
        )}

        {/* ── MODE A: Lecture-Specific Adaptive Experience ───────────────────── */}
        {activeTab === 'lecture' && (
          <div className="flex flex-col gap-6">
            {!selectedLectureId ? (
              <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center flex flex-col items-center justify-center gap-4">
                <span className="text-5xl" aria-hidden="true">🎯</span>
                <h3 className="text-xl font-bold text-text-primary">Select a Recorded Lecture</h3>
                <p className="text-sm text-text-secondary max-w-md">
                  Choose any recorded lecture from the dropdown above to inspect which topics qualify for 3D simulations, 2D diagrams, or structured notes.
                </p>
                {lecturesList.length > 0 && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleSelectLecture(lecturesList[0].id || lecturesList[0].lectureId)}
                  >
                    Load Sample Lecture: {lecturesList[0].title || 'First Lecture'} →
                  </Button>
                )}
              </div>
            ) : loading ? (
              <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <h3 className="text-lg font-bold text-text-primary">Evaluating Lecture Topics</h3>
                <p className="text-sm text-text-muted">
                  Analyzing transcript segments, domain context, and formula structures for visual suitability…
                </p>
              </div>
            ) : loadError ? (
              <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-8 text-center text-rose-200">
                <span className="text-4xl block mb-2">⚠️</span>
                <h3 className="text-lg font-bold">Could Not Load Lecture</h3>
                <p className="text-sm text-rose-300/80 mt-1">{loadError}</p>
              </div>
            ) : lectureManifest ? (
              <div className="flex flex-col gap-6">
                {/* Lecture Topic Selector Bar */}
                <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 flex flex-col gap-3 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/80 pb-3">
                    <div>
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                        Evaluated Topics in this Lecture ({lectureManifest.totalTopics}):
                      </span>
                      <h2 className="text-lg font-extrabold text-text-primary">
                        {lectureManifest.lectureTitle}
                      </h2>
                    </div>
                    <Badge variant={lectureManifest.recommendedVisualizationsCount > 0 ? 'cyan' : 'neutral'}>
                      {lectureManifest.recommendedVisualizationsCount} Visualizer{lectureManifest.recommendedVisualizationsCount !== 1 ? 's' : ''} Recommended
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {lectureManifest.topics?.map((top) => {
                      const isSelected = activeTopicId === top.topicId;
                      const is3D = top.suitabilityCategory === 'CATEGORY_A';
                      const is2D = top.suitabilityCategory === 'CATEGORY_B';

                      return (
                        <button
                          key={top.topicId}
                          onClick={() => handleSelectTopic(top.topicId)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/50 shadow-md'
                              : 'bg-surface-elevated/70 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-slate-600'
                          }`}
                        >
                          <span aria-hidden="true">{is3D ? '⚡' : is2D ? '📐' : '📖'}</span>
                          <span>{top.topicTitle}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              is3D
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : is2D
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-700/50 text-slate-400'
                            }`}
                          >
                            {is3D ? '3D' : is2D ? '2D' : 'Theory'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Topic Visualizer Host */}
                <LectureVisualizerHost
                  lectureId={selectedLectureId}
                  lectureTitle={lectureManifest.lectureTitle}
                  visualization={activeLectureViz}
                  onReturnToLecture={() => navigate(`/lecture/${selectedLectureId}`)}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* ── MODE B: Supported Visualizers Reference Catalog ────────────────── */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-6">
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 flex flex-col gap-3">
              <h2 className="text-xl font-bold text-text-primary">
                Supported Visualizer Architecture & Syllabus Catalog
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                LectureLens only triggers these visual engines when a recorded lecture's transcript, whiteboard extractions, or notes match their exact conceptual requirements.
              </p>
            </div>

            {/* Catalog Selector Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(VISUALIZER_REGISTRY).filter((v) => v.id !== '2d_diagram').map((mod) => {
                const isSelected = activeCatalogModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleSelectCatalogModule(mod.id)}
                    className={`flex flex-col text-left p-5 rounded-2xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-surface-card border-cyan-500/50 shadow-xl'
                        : 'bg-surface-card/60 border-border-subtle hover:border-slate-700 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2.5 font-bold text-base text-text-primary">
                        <span aria-hidden="true">{mod.icon}</span>
                        {mod.name}
                      </span>
                      <Badge variant={isSelected ? 'cyan' : 'neutral'} size="sm">
                        {mod.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                      {mod.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Catalog Details & Sandbox Stage */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 flex flex-col gap-6 shadow-card">
              <div className="flex flex-col gap-2 border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentCatalogDef.icon}</span>
                  <div>
                    <h3 className="text-2xl font-extrabold text-text-primary">{currentCatalogDef.name}</h3>
                    <p className="text-xs text-cyan-400 font-semibold">{currentCatalogDef.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mt-1">{currentCatalogDef.description}</p>
              </div>

              {/* Specification Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-text-secondary bg-surface-base p-4 rounded-xl border border-border-subtle">
                <div>
                  <strong className="text-text-primary block font-bold mb-1">Supported Syllabus Concepts:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                    {currentCatalogDef.supportedConceptTypes.map((c, i) => (
                      <li key={i} className="capitalize">{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong className="text-text-primary block font-bold mb-1">Key Verification Capabilities:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                    {currentCatalogDef.capabilities.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Simulation Stage (Isolated by module ID) */}
              <div className="w-full">
                <Suspense fallback={
                  <div className="w-full bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    <p className="text-sm text-cyan-300 font-semibold">Loading 3D Interactive Simulation Module...</p>
                  </div>
                }>
                  {activeCatalogModule === 'raft' && <DistributedConsensus3D key="catalog_raft" />}
                  {activeCatalogModule === 'avl' && <AvlTree3D key="catalog_avl" />}
                  {activeCatalogModule === 'neural' && <NeuralNetwork3D key="catalog_neural" />}
                </Suspense>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
