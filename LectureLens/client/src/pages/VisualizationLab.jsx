import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Button from '../components/Button';
import DistributedConsensus3D from '../components/lab/DistributedConsensus3D';
import AvlTree3D from '../components/lab/AvlTree3D';
import NeuralNetwork3D from '../components/lab/NeuralNetwork3D';
import { isWebGLAvailable } from '../utils/webglSupport';

const MODULES = [
  {
    id: 'raft',
    title: 'Distributed Systems',
    subtitle: 'Raft Consensus Protocol',
    icon: '⚡',
    badge: 'Consensus & Quorums',
    description: 'Inspect leader election terms, heartbeat propagation, log entry replication, and network partitions with true majority quorums (3/5).',
  },
  {
    id: 'avl',
    title: 'Data Structures',
    subtitle: 'Self-Balancing AVL Tree',
    icon: '🌳',
    badge: 'O(log N) BST',
    description: 'Interact with binary search tree insertion, key search traversal paths, and exact height-balanced LL, RR, LR, and RL rotations.',
  },
  {
    id: 'neural',
    title: 'Neural Networks',
    subtitle: 'Multi-Layer Perceptron (MLP)',
    icon: '🧠',
    badge: 'Feedforward Pass',
    description: 'Step through real matrix multiplication $Z = W^T X + B$, non-linear Sigmoid/ReLU/Tanh activations, and output probabilities.',
  },
];

export default function VisualizationLab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialModule = searchParams.get('module') || 'raft';
  const [activeModule, setActiveModule] = useState(
    MODULES.some((m) => m.id === initialModule) ? initialModule : 'raft'
  );
  const [webglSupported, setWebglSupported] = useState(true);

  // Check WebGL availability on mount
  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);

  const handleSelectModule = (id) => {
    setActiveModule(id);
    setSearchParams({ module: id });
  };

  const currentModuleData = MODULES.find((m) => m.id === activeModule) || MODULES[0];

  return (
    <div className="min-h-screen bg-surface-base text-text-primary flex flex-col selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Shared Accessible Navigation */}
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Lab Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">🔬</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
                3D Educational Visualization Lab
              </h1>
              <Badge variant="cyan">Three.js Engine</Badge>
            </div>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
              Interactive 3D mathematical simulations designed to bridge conceptual abstraction into tangible intuition. Verified algorithmic correctness with full keyboard and non-3D accessibility.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              aria-label="Return to Dashboard"
            >
              ← Back to Dashboard
            </Button>
          </div>
        </div>

        {/* WebGL Support Notice / Fallback Banner */}
        {!webglSupported && (
          <div
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm flex items-start gap-3"
            role="alert"
          >
            <span className="text-xl" aria-hidden="true">⚠️</span>
            <div>
              <strong className="font-semibold block mb-0.5">Hardware WebGL Acceleration Unavailable</strong>
              Your current browser or hardware environment does not support WebGL 3D rendering. The lab has automatically fallen back to the accessible tabular state inspection mode below, presenting all real-time mathematical calculations and state transitions without loss of educational fidelity.
            </div>
          </div>
        )}

        {/* Module Selection Navigation Bar */}
        <section aria-label="Educational Module Selector">
          <div
            role="tablist"
            aria-label="Visualization modules"
            className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1.5 rounded-2xl bg-surface-card border border-border-subtle shadow-card"
          >
            {MODULES.map((mod) => {
              const isSelected = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  role="tab"
                  id={`tab-${mod.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${mod.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => handleSelectModule(mod.id)}
                  className={`flex flex-col text-left p-4 rounded-xl transition-all duration-200 min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    isSelected
                      ? 'bg-surface-elevated border border-cyan-500/40 shadow-lg text-text-primary'
                      : 'border border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-base/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 font-semibold text-sm sm:text-base">
                      <span aria-hidden="true">{mod.icon}</span>
                      {mod.title}
                    </span>
                    <Badge variant={isSelected ? 'cyan' : 'neutral'} size="sm">
                      {mod.badge}
                    </Badge>
                  </div>
                  <div className="text-xs text-text-muted line-clamp-2">
                    {mod.subtitle} — {mod.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Active Module Canvas & Interactive Panel */}
        <section
          role="tabpanel"
          id={`panel-${currentModuleData.id}`}
          aria-labelledby={`tab-${currentModuleData.id}`}
          className="w-full"
        >
          {activeModule === 'raft' && <DistributedConsensus3D />}
          {activeModule === 'avl' && <AvlTree3D />}
          {activeModule === 'neural' && <NeuralNetwork3D />}
        </section>

        {/* Curriculum Integration Footer */}
        <section className="rounded-xl border border-border-subtle bg-surface-card/60 p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-muted mt-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">💡</span>
            <div>
              <span className="font-semibold text-text-primary block">LectureLens Curriculum Integration</span>
              These interactive simulations are referenced directly inside post-lecture study guides, automated chapter notes, and AI Q&A responses when covering distributed consensus, algorithms, or machine learning topics.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="cyan" size="sm">Phase 9 Redesign</Badge>
            <Badge variant="neutral" size="sm">v2.4.0</Badge>
          </div>
        </section>
      </main>
    </div>
  );
}
