/**
 * salkgGuardService.js
 * 
 * Orchestration engine for SALKG-Guard:
 * - Claim Decomposition
 * - Multimodal Provenance Path Resolution
 * - Dual-Axis Validation (Lecture Faithfulness vs. Domain Correctness)
 * - Contradiction & Dependency Analysis
 * - Risk-Calibrated Decision Engine (ACCEPT, REGENERATE, ABSTAIN, NEEDS_REVIEW)
 * - Bounded Targeted Correction Loop
 * - SQLite Persistence for Validation Reports
 */

const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');
const { getOrComputeSALKG, formatSALKGContextForPrompt } = require('./salkgAdapter');
const { callGemini } = require('./aiModelHelper');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const GUARD_PIPELINE_SCRIPT = path.join(PROJECT_ROOT, 'research_salkg_guard', 'src', 'salkg_guard', 'pipeline.py');
const DB_PATH = path.join(__dirname, '..', 'data', 'lecturelens.sqlite');

/**
 * Invoke Python SALKG-Guard pipeline subprocess
 */
function invokeGuardPipeline({ lectureId, artifact, contentType = 'rag_answer', domain = null, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const args = [
      GUARD_PIPELINE_SCRIPT,
      '--db', DB_PATH,
      '--lecture-id', String(lectureId),
      '--content-type', contentType,
    ];

    if (domain) {
      args.push('--domain', domain);
    }

    const guardSrc = path.join(PROJECT_ROOT, 'research_salkg_guard', 'src');
    const salkgSrc = path.join(PROJECT_ROOT, 'research_salkg', 'src');
    const pythonPath = [guardSrc, salkgSrc].join(path.delimiter);

    const child = spawn(pythonCmd, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: pythonPath },
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`SALKG-Guard pipeline timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    // Pass artifact as stdin JSON/text
    const inputPayload = typeof artifact === 'string' ? artifact : JSON.stringify(artifact);
    child.stdin.write(inputPayload);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`SALKG-Guard exited with code ${code}: ${stderr || stdout}`));
      }
      try {
        const report = JSON.parse(stdout);
        resolve(report);
      } catch (err) {
        reject(new Error(`Failed to parse SALKG-Guard report: ${err.message}. Output: ${stdout.slice(0, 300)}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn SALKG-Guard subprocess: ${err.message}`));
    });
  });
}

/**
 * Validate an artifact with SALKG-Guard and persist the report in SQLite
 */
async function validateWithSALKGGuard(artifactOrOptions, maybeLectureId, options = {}) {
  let artifact = artifactOrOptions;
  let lectureId = maybeLectureId;
  let opts = options;

  if (
    typeof artifactOrOptions === 'object' &&
    artifactOrOptions !== null &&
    !Array.isArray(artifactOrOptions) &&
    (artifactOrOptions.lectureId || artifactOrOptions.generatedContent)
  ) {
    artifact = artifactOrOptions.generatedContent || artifactOrOptions.artifact;
    lectureId = artifactOrOptions.lectureId;
    opts = {
      contentType: artifactOrOptions.contentType,
      domain: artifactOrOptions.domain,
      query: artifactOrOptions.query,
      timeoutMs: artifactOrOptions.timeoutMs,
      ...options,
    };
  }

  const lecture = await get('SELECT id, room_id, title FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  const resolvedId = lecture ? lecture.id : lectureId;

  try {
    const report = await invokeGuardPipeline({
      lectureId: resolvedId,
      artifact,
      contentType: opts.contentType || 'rag_answer',
      domain: opts.domain || null,
      timeoutMs: opts.timeoutMs || 20000,
    });

    // Persist validation report in SQLite
    const reportId = 'grd_' + uuidv4().slice(0, 8);
    const requestId = report.request_id || uuidv4().slice(0, 8);

    await run(
      `INSERT INTO salkg_guard_reports (id, request_id, lecture_id, content_type, domain, decision, decision_reason, retry_count, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        requestId,
        resolvedId,
        report.content_type || opts.contentType || 'rag_answer',
        report.domain || 'unknown',
        report.overall_decision || 'ACCEPT',
        report.decision_reason || '',
        opts.retryCount || 0,
        JSON.stringify(report),
      ]
    ).catch((e) => console.warn('[SALKG-Guard] Report write warning:', e.message));

    return {
      success: true,
      report,
      decision: report.overall_decision,
      overall_decision: report.overall_decision,
      ...report,
    };
  } catch (err) {
    console.warn(`[SALKG-Guard] Validation failed for ${resolvedId}: ${err.message}. Engaging safe pass-through.`);
    const fallbackReport = {
      request_id: 'fallback_' + uuidv4().slice(0, 8),
      lecture_id: resolvedId,
      content_type: opts.contentType || 'rag_answer',
      domain: opts.domain || 'unknown',
      overall_decision: 'NEEDS_REVIEW',
      decision_reason: `SALKG-Guard execution failed: ${err.message}`,
      summary_metrics: {
        total_claims: 0,
        supported_claims: 0,
        contradicted_claims: 0,
        unsupported_claims: 0,
        domain_valid_claims: 0,
        domain_invalid_claims: 0,
      },
      claim_results: [],
      citation_validity_rate: 1.0,
      executed_checks: [],
      unavailable_checks: ['salkg_guard_subprocess'],
    };

    return {
      success: false,
      report: fallbackReport,
      decision: 'NEEDS_REVIEW',
      overall_decision: 'NEEDS_REVIEW',
      ...fallbackReport,
    };
  }
}

/**
 * Execute Guarded Educational Generation with Targeted Correction Loop
 */
async function runGuardedGeneration({
  lectureId,
  contentType,
  generateFn,
  domainHint = null,
  maxRetries = 2,
  onAbstain = null,
}) {
  let currentRetry = 0;
  let correctionFeedback = null;
  let artifact = null;
  let lastReport = null;

  while (currentRetry <= maxRetries) {
    // 1. Generate (with correction feedback on subsequent iterations)
    artifact = await generateFn(correctionFeedback);

    // 2. Validate with SALKG-Guard
    lastReport = await validateWithSALKGGuard(artifact, lectureId, {
      contentType,
      domain: domainHint,
      retryCount: currentRetry,
    });

    const decision = lastReport.overall_decision;

    // 3. Handle Decision
    if (decision === 'ACCEPT') {
      return {
        artifact,
        report: lastReport,
        decision: 'ACCEPT',
        retriesUsed: currentRetry,
      };
    }

    if (decision === 'ABSTAIN') {
      // Evidence is missing from this lecture; do not loop into guessing
      const abstainResponse = onAbstain
        ? onAbstain(lastReport)
        : `This topic was not covered or supported by the evidence in this lecture. To prevent factual hallucinations, the system abstains from generating unverified claims.`;

      return {
        artifact: abstainResponse,
        report: lastReport,
        decision: 'ABSTAIN',
        retriesUsed: currentRetry,
      };
    }

    if (decision === 'REGENERATE') {
      currentRetry++;
      if (currentRetry <= maxRetries) {
        correctionFeedback = lastReport.suggested_correction_feedback || lastReport.decision_reason;
        console.log(`[SALKG-Guard] Triggering targeted correction loop (${currentRetry}/${maxRetries}): ${correctionFeedback}`);
        continue;
      }
    }

    // NEEDS_REVIEW or exceeded retries
    break;
  }

  // If retries exhausted or ambiguous
  return {
    artifact,
    report: lastReport,
    decision: lastReport?.overall_decision || 'NEEDS_REVIEW',
    retriesUsed: currentRetry,
  };
}

module.exports = {
  validateWithSALKGGuard,
  runGuardedGeneration,
};
