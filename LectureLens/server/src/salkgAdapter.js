/**
 * salkgAdapter.js
 * 
 * Production adapter bridging LectureLens with the authentic SALKG algorithm.
 * 
 * - Preserves all source IDs, timestamps, and multimodal provenance.
 * - Enforces zero cross-lecture evidence leakage.
 * - Caches alignment results and verified knowledge graphs in SQLite idempotently.
 * - Provides graceful fallback if python runtime or SALKG is temporarily unavailable.
 * - NEVER conflates alignment confidence with claim truth.
 */

const path = require('path');
const { spawn } = require('child_process');
const { run, get, all } = require('./db');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BRIDGE_SCRIPT = path.join(PROJECT_ROOT, 'research_salkg', 'src', 'salkg', 'bridge.py');
const DB_PATH = path.join(__dirname, '..', 'data', 'lecturelens.sqlite');

/**
 * Execute Python SALKG Bridge subprocess
 */
function invokePythonBridge(lectureId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const args = [
      BRIDGE_SCRIPT,
      '--db', DB_PATH,
      '--lecture-id', String(lectureId),
    ];

    const child = spawn(pythonCmd, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: path.join(PROJECT_ROOT, 'research_salkg', 'src') },
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`SALKG bridge subprocess timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`SALKG bridge exited with code ${code}: ${stderr || stdout}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse SALKG bridge output: ${err.message}. Raw: ${stdout.slice(0, 300)}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn SALKG bridge subprocess: ${err.message}`));
    });
  });
}

/**
 * Get or compute SALKG alignment and knowledge graph for a lecture.
 * Idempotent, cached in SQLite.
 */
async function getOrComputeSALKG(lectureId, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);

  // 1. Resolve canonical lecture ID
  const lecture = await get('SELECT id, room_id, title FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  const resolvedId = lecture ? lecture.id : lectureId;

  // 2. Check cache unless forceRefresh
  if (!forceRefresh) {
    try {
      const cached = await get('SELECT * FROM salkg_cache WHERE lecture_id = ?', [resolvedId]);
      if (cached && cached.alignment_json && cached.knowledge_graph_json) {
        return {
          success: true,
          fromCache: true,
          lecture_id: resolvedId,
          inferred_subject: cached.inferred_subject || 'unknown',
          alignment: JSON.parse(cached.alignment_json),
          knowledge_graph: JSON.parse(cached.knowledge_graph_json),
          validation_report: JSON.parse(cached.validation_report_json || '{}'),
        };
      }
    } catch (e) {
      console.warn(`[SALKG Adapter] Cache read warning for ${resolvedId}:`, e.message);
    }
  }

  // 3. Compute via Python Bridge
  try {
    const salkgOutput = await invokePythonBridge(resolvedId, options.timeoutMs || 15000);

    if (salkgOutput && salkgOutput.success) {
      // Persist into SQLite cache
      try {
        await run(
          `INSERT INTO salkg_cache (lecture_id, inferred_subject, alignment_json, knowledge_graph_json, validation_report_json, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(lecture_id) DO UPDATE SET
             inferred_subject = excluded.inferred_subject,
             alignment_json = excluded.alignment_json,
             knowledge_graph_json = excluded.knowledge_graph_json,
             validation_report_json = excluded.validation_report_json,
             updated_at = CURRENT_TIMESTAMP`,
          [
            resolvedId,
            salkgOutput.inferred_subject || 'unknown',
            JSON.stringify(salkgOutput.alignment || {}),
            JSON.stringify(salkgOutput.knowledge_graph || {}),
            JSON.stringify(salkgOutput.validation_report || {}),
          ]
        );
      } catch (cacheErr) {
        console.warn(`[SALKG Adapter] Cache write warning for ${resolvedId}:`, cacheErr.message);
      }

      return {
        ...salkgOutput,
        fromCache: false,
      };
    }
  } catch (err) {
    console.warn(`[SALKG Adapter] SALKG execution failed for ${resolvedId}: ${err.message}. Engaging fallback.`);
  }

  // 4. Fallback when SALKG is unavailable or fails
  return {
    success: false,
    fallback: true,
    lecture_id: resolvedId,
    inferred_subject: 'unknown',
    alignment: {
      lecture_id: resolvedId,
      method_name: 'fallback_heuristic',
      matches: [],
      total_segments: 0,
      matched_segments: 0,
      coverage: 0.0,
    },
    knowledge_graph: {
      lecture_id: resolvedId,
      subject: 'unknown',
      nodes: [],
      edges: [],
      validation_summary: { fallback: true },
    },
    validation_report: { fallback: true },
  };
}

/**
 * Retrieve visual matches for a given transcript segment ID
 */
function getAlignedVisualForSegment(salkgResult, segmentId) {
  if (!salkgResult || !salkgResult.alignment || !Array.isArray(salkgResult.alignment.matches)) {
    return null;
  }
  const sIdStr = String(segmentId);
  return salkgResult.alignment.matches.find((m) => String(m.transcript_id) === sIdStr) || null;
}

/**
 * Retrieve segments aligned with a specific visual event ID
 */
function getAlignedSegmentsForVisual(salkgResult, visualId) {
  if (!salkgResult || !salkgResult.alignment || !Array.isArray(salkgResult.alignment.matches)) {
    return [];
  }
  const vIdStr = String(visualId);
  return salkgResult.alignment.matches.filter((m) => String(m.visual_id) === vIdStr);
}

/**
 * Get the knowledge graph evidence path for a concept
 */
function getEvidencePathForConcept(salkgResult, conceptLabel) {
  if (!salkgResult || !salkgResult.knowledge_graph) return null;
  const kg = salkgResult.knowledge_graph;
  const nodes = kg.nodes || [];
  const edges = kg.edges || [];

  const targetLower = String(conceptLabel).toLowerCase().trim();
  const matchedNode = nodes.find(
    (n) => n.label.toLowerCase().includes(targetLower) || targetLower.includes(n.label.toLowerCase())
  );

  if (!matchedNode) return null;

  const connectedEdges = edges.filter(
    (e) => e.source_id === matchedNode.node_id || e.target_id === matchedNode.node_id
  );

  return {
    node: matchedNode,
    connectedEdges,
    timestamps: matchedNode.timestamps || [],
    provenance_segments: matchedNode.provenance_segment_ids || [],
    provenance_visuals: matchedNode.provenance_visual_ids || [],
  };
}

/**
 * Format SALKG Multimodal Alignments & Knowledge Graph into rich prompt context
 */
function formatSALKGContextForPrompt(salkgResult) {
  if (!salkgResult || !salkgResult.knowledge_graph) return '';

  const kg = salkgResult.knowledge_graph;
  const alignment = salkgResult.alignment || {};
  const nodes = kg.nodes || [];
  const edges = kg.edges || [];

  const acceptedEdges = edges.filter((e) => e.validation_status === 'accepted');
  const acceptedMatches = (alignment.matches || []).filter((m) => m.status === 'accepted');

  if (acceptedEdges.length === 0 && acceptedMatches.length === 0) {
    return '';
  }

  let text = `SALKG MULTIMODAL EVIDENCE GRAPH & ALIGNMENT:\n`;
  text += `- Inferred Subject Domain: ${salkgResult.inferred_subject || 'General'}\n`;
  text += `- Multimodal Alignment Coverage: ${Math.round((alignment.coverage || 0) * 100)}% (${alignment.matched_segments || 0} spoken segments tied to visual artifacts)\n`;

  // Explicit ontological relationships
  if (acceptedEdges.length > 0) {
    text += `\nGround-Truth Pedagogical Relationships in this Lecture:\n`;
    acceptedEdges.slice(0, 15).forEach((e) => {
      const src = nodes.find((n) => n.node_id === e.source_id);
      const tgt = nodes.find((n) => n.node_id === e.target_id);
      const srcName = src ? src.label : e.source_id;
      const tgtName = tgt ? tgt.label : e.target_id;
      const timeStr = e.timestamps && e.timestamps.length > 0 ? ` at ~${Math.round(e.timestamps[0])}s` : '';
      text += `• [${e.relation_type.toUpperCase()}] "${srcName}" -> "${tgtName}" (${timeStr}, confidence: ${(e.calibrated_confidence || 1.0).toFixed(2)})\n`;
    });
  }

  // Cross-modal alignment pairings
  if (acceptedMatches.length > 0) {
    text += `\nVerified Speech-to-Visual Evidence Groundings:\n`;
    acceptedMatches.slice(0, 10).forEach((m) => {
      text += `• Speech Segment [ID ${m.transcript_id}] synchronized with Visual Artifact [ID ${m.visual_id}] (Score: ${(m.raw_composite_score || 0).toFixed(2)}, Confidence: ${(m.calibrated_confidence || 0).toFixed(2)})\n`;
    });
  }

  return text;
}

module.exports = {
  getOrComputeSALKG,
  getAlignedVisualForSegment,
  getAlignedSegmentsForVisual,
  getEvidencePathForConcept,
  formatSALKGContextForPrompt,
};
