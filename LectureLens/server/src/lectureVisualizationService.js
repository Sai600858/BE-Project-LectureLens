/**
 * lectureVisualizationService.js
 *
 * Production Topic-Aware, Lecture-Specific Adaptive Visualization Pipeline for LectureLens.
 *
 * Enforces:
 * 1. Visualizations strictly belong to a specific lecture and topic.
 * 2. Visualizations are only recommended when providing genuine educational benefit.
 * 3. Categorizes topics into:
 *    - CATEGORY_A: Interactive 3D (Raft, AVL Trees, Neural Networks MLP)
 *    - CATEGORY_B: 2D Interactive / Diagram (Coordinate graphs, flowcharts, timelines, SQL transformations)
 *    - CATEGORY_C: Conventional Learning Material (Notes, equations, definitions - no forced visuals)
 * 4. Grounding in actual lecture transcript segments, timestamps, and notes.
 * 5. Strict lecture isolation preventing cross-lecture state bleed.
 */

const { get, all } = require('./db');

// In-memory cache for fast lookups per lecture
const vizManifestCache = new Map();

/**
 * Known deterministic 3D Visualizer Signatures
 */
const REGISTERED_3D_MODULES = {
  raft: {
    id: 'raft',
    title: 'Distributed Consensus: Raft Protocol',
    modality: '3D',
    category: 'CATEGORY_A',
    keywords: [
      'raft', 'distributed consensus', 'leader election', 'quorum', 'log replication',
      'split-brain', 'heartbeat', 'requestvote', 'appendentries', 'distributed system',
      'network partition', 'fault tolerance', 'paxos'
    ],
    learningObjective: 'Observe how distributed nodes maintain consistency across network partitions and elect leaders using majority quorums (3/5).',
    suitabilityRationale: 'Spatial 3D representation is essential for visualizing asynchronous packet propagation, concurrent node states (Leader/Follower/Candidate), and partition boundaries across multiple machines.',
    instructions: [
      'Observe the active Leader (Node 1 in emerald) broadcasting heartbeats.',
      'Click a node to toggle crash/partition and witness election timeout triggering.',
      'Observe RequestVote RPC packets arcing across the cluster and quorum verification (>= 3/5 votes).',
      'Propose a new log entry to observe replication across followers.'
    ],
    assumptions: 'Simulates a canonical 5-node cluster with network latency and crash-stop/crash-recovery failure semantics (CFT).',
    limitations: 'Does not model Byzantine (arbitrary/malicious) network faults or dynamic cluster resizing.'
  },
  avl: {
    id: 'avl',
    title: 'Data Structures: Self-Balancing AVL Tree',
    modality: '3D',
    category: 'CATEGORY_A',
    keywords: [
      'avl', 'avl tree', 'self-balancing', 'binary search tree', 'tree rotation',
      'balance factor', 'left rotation', 'right rotation', 'double rotation', 'height balanced',
      'bst balance', 'tree height'
    ],
    learningObjective: 'Understand how self-balancing binary search trees maintain O(log N) depth through local tree rotations when the balance factor exceeds [-1, 1].',
    suitabilityRationale: '3D hierarchical branching geometry makes height differences, child subtree handoffs, and spatial rotations immediately clear compared to static 2D sketches.',
    instructions: [
      'Insert numerical keys to observe dynamic tree growth and height leveling.',
      'Notice balance factors dynamically computed as BF = Height(Left) - Height(Right).',
      'Trigger unbalanced insertions (e.g. sorted sequence) to step through LL, RR, LR, and RL rotations.',
      'Search for existing keys to trace the logarithmic search path from root to leaf.'
    ],
    assumptions: 'Implements standard Adelson-Velsky and Landis strict height balancing with unique integer keys.',
    limitations: 'Optimized for trees up to depth 5 for clear spatial comprehension on standard viewports.'
  },
  neural: {
    id: 'neural',
    title: 'Machine Learning: Multi-Layer Perceptron (MLP)',
    modality: '3D',
    category: 'CATEGORY_A',
    keywords: [
      'neural network', 'perceptron', 'mlp', 'feedforward', 'activation function',
      'sigmoid', 'relu', 'tanh', 'weights and biases', 'matrix multiplication',
      'deep learning', 'synapse', 'hidden layer', 'softmax'
    ],
    learningObjective: 'Step through feedforward matrix multiplication Z = W^T X + B and observe how non-linear activations shape output classification probabilities.',
    suitabilityRationale: '3D spatial layering naturally represents multi-layer topology with glowing synaptic weights (positive vs negative) and animated signal transmission waves.',
    instructions: [
      'Tweak input feature values and observe signal pulse waves travelling across layers.',
      'Switch non-linear activation functions between Sigmoid, ReLU, and Tanh to observe saturation.',
      'Inspect real-time matrix arithmetic breakdowns for each neuron.',
      'Load circuit presets (Binary Classifier, Feature Extractor, Inhibitor) to study architectural behaviors.'
    ],
    assumptions: 'Models a 2-3-2 feedforward Multi-Layer Perceptron with Softmax output distribution.',
    limitations: 'Demonstrates feedforward inference; backpropagation gradient updates are represented via weight presets rather than live training loops.'
  }
};

/**
 * Evaluates whether text matches any of the registered 3D visualizers
 */
function match3DVisualizer(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [key, mod] of Object.entries(REGISTERED_3D_MODULES)) {
    for (const kw of mod.keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        return mod;
      }
    }
  }
  return null;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Main service: Gathers lecture context and evaluates topic visualization suitability
 */
async function evaluateLectureTopicVisualizations(lectureId, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const resolvedId = String(lectureId).trim();

  if (!forceRefresh && vizManifestCache.has(resolvedId)) {
    return vizManifestCache.get(resolvedId);
  }

  // 1. Fetch lecture details
  const lecture = await get(
    'SELECT * FROM lectures WHERE id = ? OR room_id = ?',
    [resolvedId, resolvedId]
  );

  if (!lecture) {
    throw new Error(`Lecture with ID '${resolvedId}' not found.`);
  }

  const lectureDbId = lecture.id;

  // 2. Fetch transcript segments
  const segments = await all(
    'SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
    [lectureDbId, lecture.room_id]
  );

  // 3. Fetch chapters
  const chapters = await all(
    'SELECT * FROM lecture_chapters WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
    [lectureDbId, lecture.room_id]
  );

  // 4. Fetch study notes
  const notesRow = await get(
    'SELECT * FROM study_notes WHERE lecture_id = ? OR lecture_id = ? ORDER BY created_at DESC LIMIT 1',
    [lectureDbId, lecture.room_id]
  );

  let noteSections = [];
  let existingViz = [];
  if (notesRow) {
    try {
      noteSections = notesRow.sections_json ? JSON.parse(notesRow.sections_json) : [];
    } catch (_) {}
    try {
      existingViz = notesRow.visualizations_json ? JSON.parse(notesRow.visualizations_json) : [];
    } catch (_) {}
  }

  // 5. Build candidate topics list from chapters, sections, or lecture title/content
  const candidateTopics = [];

  // Source A: Sections from study notes
  if (noteSections.length > 0) {
    noteSections.forEach((sec, idx) => {
      candidateTopics.push({
        source: 'NOTES_SECTION',
        id: `topic_sec_${idx + 1}`,
        title: sec.heading || `Section ${idx + 1}`,
        description: sec.explanation || sec.takeaway || '',
        approxTimestamp: idx * 90.0,
        linkedViz: existingViz.find((v) => v.id === sec.visualization?.id || v.sectionHeading === sec.heading),
      });
    });
  }

  // Source B: Chapters
  if (chapters.length > 0 && candidateTopics.length === 0) {
    chapters.forEach((ch, idx) => {
      candidateTopics.push({
        source: 'CHAPTER',
        id: `topic_ch_${idx + 1}`,
        title: ch.title || `Chapter ${idx + 1}`,
        description: ch.summary || '',
        approxTimestamp: ch.start_time ?? ch.startTime ?? 0,
        linkedViz: null,
      });
    });
  }

  // Source C: Fallback to single primary topic if none extracted yet
  if (candidateTopics.length === 0) {
    candidateTopics.push({
      source: 'LECTURE_META',
      id: 'topic_primary_1',
      title: lecture.title || 'Lecture Overview',
      description: lecture.description || lecture.subject || 'Core lecture concepts and instructional materials.',
      approxTimestamp: 0,
      linkedViz: null,
    });
  }

  // 6. Evaluate each candidate topic for visual suitability
  const topicsReport = [];
  const recommendedVisualizations = [];

  for (const cand of candidateTopics) {
    const combinedText = `${cand.title} ${cand.description} ${lecture.title || ''} ${lecture.subject || ''}`;
    
    // Find matching transcript segments for timestamp grounding
    const matchingSegments = segments.filter((s) => {
      const segText = (s.text || '').toLowerCase();
      const titleWords = cand.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return titleWords.some((w) => segText.includes(w));
    }).slice(0, 4);

    const sourceTimestamps = matchingSegments.length > 0
      ? matchingSegments.map((s) => s.start_time)
      : [cand.approxTimestamp];

    const sourceSegmentsFormatted = matchingSegments.map((s) => ({
      timestamp: s.start_time,
      formattedTime: formatTime(s.start_time),
      speaker: s.speaker_name || 'Instructor',
      text: s.text,
    }));

    // Step A: Check 3D Module Match
    const match3D = match3DVisualizer(combinedText);

    if (match3D) {
      const vizItem = {
        topicId: cand.id,
        topicTitle: cand.title,
        lectureId: lectureDbId,
        lectureRoomId: lecture.room_id,
        visualizationType: '3D',
        visualizerId: match3D.id,
        suitabilityCategory: 'CATEGORY_A',
        learningObjective: match3D.learningObjective,
        suitabilityRationale: match3D.suitabilityRationale,
        sourceTimestamps,
        sourceTranscriptSegments: sourceSegmentsFormatted,
        grounding: {
          evidenceType: sourceSegmentsFormatted.length > 0 ? 'TRANSCRIPT_GROUNDED' : 'CURRICULUM_ALIGNED',
          lectureEvidence: sourceSegmentsFormatted.length > 0
            ? `Referenced in lecture at ${sourceSegmentsFormatted.map((s) => s.formattedTime).join(', ')}.`
            : `Derived from lecture syllabus: "${cand.title}".`,
          simulationAssumptions: match3D.assumptions,
          limitations: match3D.limitations,
        },
        instructions: match3D.instructions,
        spec: {
          visualizerTitle: match3D.title,
          modality: '3D WebGL (Three.js)',
        },
      };

      topicsReport.push({
        topicId: cand.id,
        topicTitle: cand.title,
        suitabilityCategory: 'CATEGORY_A',
        visualizationType: '3D',
        visualizerId: match3D.id,
        recommended: true,
        reasoning: match3D.suitabilityRationale,
        learningObjective: match3D.learningObjective,
      });

      recommendedVisualizations.push(vizItem);
      continue;
    }

    // Step B: Check 2D Diagram Match (Category B)
    if (cand.linkedViz || combinedText.toLowerCase().includes('sql') ||
        combinedText.toLowerCase().includes('flow') || combinedText.toLowerCase().includes('function') ||
        combinedText.toLowerCase().includes('graph') || combinedText.toLowerCase().includes('plot') ||
        combinedText.toLowerCase().includes('timeline')) {
      
      const v = cand.linkedViz || {};
      const type = v.type || 'flowchart';

      const vizItem = {
        topicId: cand.id,
        topicTitle: cand.title,
        lectureId: lectureDbId,
        lectureRoomId: lecture.room_id,
        visualizationType: '2D',
        visualizerId: '2d_diagram',
        suitabilityCategory: 'CATEGORY_B',
        learningObjective: `Analyze the structural relationships, process flow, and mathematical behavior of ${cand.title}.`,
        suitabilityRationale: 'A deterministic 2D vector diagram/flowchart provides immediate clarity for sequential transformations, mathematical function plotting, and coordinate mappings without 3D perspective distortion.',
        sourceTimestamps,
        sourceTranscriptSegments: sourceSegmentsFormatted,
        grounding: {
          evidenceType: 'NOTES_AND_DIAGRAM',
          lectureEvidence: v.caption || `Extracted from lecture section "${cand.title}".`,
          simulationAssumptions: 'Deterministic vector geometry rendered directly from algorithmic specifications.',
          limitations: 'Static/step-by-step vector representation; spatial rotations not applicable.',
        },
        instructions: [
          'Examine the highlighted input-to-output data transitions.',
          'Review the connection note to see how this visual explains the governing formula or code logic.',
          'Use the zoom control to inspect fine-grained vector details.'
        ],
        spec: {
          type,
          title: v.title || cand.title,
          caption: v.caption || cand.description,
          svg: v.svg || null,
          connectionToFormula: v.connectionToFormula || null,
          imagePath: v.imagePath || null,
        },
      };

      topicsReport.push({
        topicId: cand.id,
        topicTitle: cand.title,
        suitabilityCategory: 'CATEGORY_B',
        visualizationType: '2D',
        visualizerId: '2d_diagram',
        recommended: true,
        reasoning: '2D vector diagrams and flowcharts clarify sequential steps, timelines, and coordinate geometry better than 3D scenes.',
        learningObjective: vizItem.learningObjective,
      });

      recommendedVisualizations.push(vizItem);
      continue;
    }

    // Step C: Conventional Learning Material (Category C)
    // No forced visualization when simple notes, formulas, or text are pedagogically optimal
    topicsReport.push({
      topicId: cand.id,
      topicTitle: cand.title,
      suitabilityCategory: 'CATEGORY_C',
      visualizationType: 'CONVENTIONAL',
      visualizerId: null,
      recommended: false,
      reasoning: 'Concept is straightforward theoretical or definitional content. Best understood via structured notes, mathematical derivations, and review questions without redundant visual clutter.',
      learningObjective: `Master core definitions, principles, and analytical questions for ${cand.title}.`,
    });
  }

  const manifest = {
    lectureId: lectureDbId,
    lectureRoomId: lecture.room_id,
    lectureTitle: lecture.title || 'Untitled Lecture',
    lectureSubject: lecture.subject || 'General Studies',
    totalTopics: topicsReport.length,
    recommendedVisualizationsCount: recommendedVisualizations.length,
    has3DVisualizations: recommendedVisualizations.some((v) => v.visualizationType === '3D'),
    has2DVisualizations: recommendedVisualizations.some((v) => v.visualizationType === '2D'),
    topics: topicsReport,
    recommendedVisualizations,
    supportedVisualizersCatalog: Object.values(REGISTERED_3D_MODULES).map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      learningObjective: m.learningObjective,
      supportedKeywords: m.keywords,
      limitations: m.limitations,
    })),
  };

  vizManifestCache.set(resolvedId, manifest);
  return manifest;
}

/**
 * Clear cache for a lecture when new notes or transcripts are ingested
 */
function invalidateLectureVisualizationCache(lectureId) {
  if (lectureId) {
    vizManifestCache.delete(String(lectureId).trim());
  }
}

module.exports = {
  evaluateLectureTopicVisualizations,
  invalidateLectureVisualizationCache,
  REGISTERED_3D_MODULES,
};
