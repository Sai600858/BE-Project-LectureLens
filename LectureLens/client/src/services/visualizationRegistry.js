/**
 * visualizationRegistry.js
 *
 * Authoritative Client-Side Registry of Supported Visualizers in LectureLens.
 *
 * Implements Section 5 of Specification:
 * - Specifies supported concept types
 * - Declares actual capabilities, controls, inputs, and limitations
 * - Reusable, well-defined visualization patterns
 * - Deterministic algorithmic execution (prevents unvalidated AI hallucinated code)
 */

export const VISUALIZATION_MODALITIES = {
  THREE_D: '3D',
  TWO_D: '2D',
  CONVENTIONAL: 'CONVENTIONAL',
};

export const VISUALIZER_REGISTRY = {
  raft: {
    id: 'raft',
    name: 'Distributed Consensus Engine',
    subtitle: 'Raft Protocol & Quorum Arithmetic',
    modality: VISUALIZATION_MODALITIES.THREE_D,
    icon: '⚡',
    badge: '3D Distributed Topology',
    description: 'Inspect asynchronous message passing, leader elections, log replication, and network partitions with majority quorums (3/5).',
    supportedConceptTypes: [
      'distributed consensus',
      'raft protocol',
      'leader election',
      'distributed log replication',
      'network partition',
      'majority quorum',
      'split-brain avoidance',
      'heartbeat synchronization',
    ],
    capabilities: [
      'Interactive 5-node cluster in 3D network ring layout',
      'Randomized election timeouts and RequestVote RPC packet arcs',
      'AppendEntries log replication with follower acknowledgment',
      'Crash and partition simulation on any arbitrary node',
      'Real-time quorum arithmetic verification (N/2 + 1 >= 3/5)',
      'Dual-mode view: 3D WebGL Canvas and accessible Tabular State Inspector',
    ],
    inputs: {
      clusterSize: 5,
      defaultRole: 'LEADER',
      initialTerm: 1,
    },
    prerequisites: 'Basic knowledge of networked servers and state machine replication.',
    limitations: 'Simulates Crash-Fault Tolerance (CFT); does not simulate Byzantine (malicious) faults or dynamic node reconfiguration.',
  },

  avl: {
    id: 'avl',
    name: 'Self-Balancing Binary Search Tree',
    subtitle: 'AVL Tree & Height-Balanced Rotations',
    modality: VISUALIZATION_MODALITIES.THREE_D,
    icon: '🌳',
    badge: '3D Geometric BST',
    description: 'Interact with binary search tree insertion, key search paths, and exact height-balanced LL, RR, LR, and RL rotations.',
    supportedConceptTypes: [
      'avl tree',
      'self-balancing bst',
      'tree rotations',
      'balance factor',
      'left rotation (rr case)',
      'right rotation (ll case)',
      'left-right double rotation (lr case)',
      'right-left double rotation (rl case)',
      'logarithmic search traversal',
    ],
    capabilities: [
      '3D hierarchical branching geometry with depth leveling',
      'Dynamic key insertion (custom integers or presets)',
      'Live balance factor computation (BF = Height(L) - Height(R))',
      'Step-by-step visual rotations with highlighted pivot nodes',
      'O(log N) search traversal path visualization with comparison counters',
      'Dual-mode view: 3D WebGL Canvas and accessible Tree Table Inspector',
    ],
    inputs: {
      defaultKeys: [30, 20, 40, 10, 25],
      maxDepth: 5,
    },
    prerequisites: 'Understanding of standard Binary Search Tree (BST) invariant (Left < Node < Right).',
    limitations: 'Optimized for trees up to 15 unique integer nodes to maintain optimal spatial readability.',
  },

  neural: {
    id: 'neural',
    name: 'Multi-Layer Perceptron (MLP)',
    subtitle: 'Feedforward Pass & Activation Manifolds',
    modality: VISUALIZATION_MODALITIES.THREE_D,
    icon: '🧠',
    badge: '3D Synaptic Network',
    description: 'Step through feedforward matrix multiplication Z = W^T X + B and observe non-linear Sigmoid, ReLU, and Tanh activation saturations.',
    supportedConceptTypes: [
      'neural network',
      'multi-layer perceptron',
      'feedforward pass',
      'matrix multiplication',
      'activation functions',
      'sigmoid activation',
      'relu activation',
      'tanh activation',
      'weights and biases',
      'softmax probability',
    ],
    capabilities: [
      '3D layered spatial topology (2 Inputs -> 3 Hidden -> 2 Output Classes)',
      'Synaptic connections colored by weight polarity (emerald positive vs red negative)',
      'Real matrix multiplication and bias addition live display',
      'Switchable activation non-linearities (Sigmoid, ReLU, Tanh)',
      'Signal pulse wave animations traveling through layers during feedforward pass',
      'Softmax output probability gauges and circuit presets',
      'Dual-mode view: 3D WebGL Canvas and accessible Matrix Math Table',
    ],
    inputs: {
      layerTopology: [2, 3, 2],
      defaultActivation: 'sigmoid',
      presets: ['classifier', 'feature_detector', 'inhibitor'],
    },
    prerequisites: 'Familiarity with vectors, dot products, and basic non-linear math.',
    limitations: 'Demonstrates feedforward inference and activation shapes; gradient descent backpropagation is represented via curated educational presets.',
  },

  '2d_diagram': {
    id: '2d_diagram',
    name: 'Interactive Vector Diagram & Flow Engine',
    subtitle: 'Deterministic 2D Pedagogical Schematics',
    modality: VISUALIZATION_MODALITIES.TWO_D,
    icon: '📐',
    badge: '2D Deterministic SVG',
    description: 'High-clarity vector diagrams, coordinate function plots, database transformation pipelines, and flowcharts.',
    supportedConceptTypes: [
      'flowchart',
      'coordinate_graph',
      'sql transformation',
      'coalesce null handling',
      'string functions',
      'date timeline',
      'algorithm execution steps',
      'concept map',
      'process pipeline',
    ],
    capabilities: [
      'Scalable vector graphics with pan and zoom',
      'Direct visual alignment with governing mathematical formulas or code',
      'Sequential step breakdown with clear annotations',
      'Eliminates 3D perspective distortion for pure sequential workflows',
    ],
    inputs: {
      spec: null,
      svg: null,
    },
    prerequisites: 'Topic-dependent.',
    limitations: 'Does not support 3D camera orbits or spatial rotations; focused on planar information design.',
  },
};

/**
 * Returns the registered visualizer definition by ID
 */
export function getVisualizer(id) {
  return VISUALIZER_REGISTRY[id] || null;
}

/**
 * Checks whether a given concept text is supported by any registered visualizer
 */
export function findVisualizerForConcept(conceptText = '') {
  if (!conceptText) return null;
  const lower = conceptText.toLowerCase();

  for (const [id, def] of Object.entries(VISUALIZER_REGISTRY)) {
    for (const concept of def.supportedConceptTypes) {
      if (lower.includes(concept)) {
        return def;
      }
    }
  }
  return null;
}
