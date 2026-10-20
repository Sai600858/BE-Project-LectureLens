/**
 * domainContextService.js
 * 
 * Production Metadata-Driven Domain & Topic Understanding Engine for LectureLens.
 * 
 * Orchestrates:
 * 1. Authoritative Lecture Metadata Domain Extraction
 * 2. General-Purpose Metadata–Content Consistency Checking
 * 3. Dynamic Section-Level Topic & Learning Objective Discovery
 * 4. Safe Handling of Broad Titles, Multidisciplinary Lectures, & Topic Transitions
 * 5. Transparent Provisional Inference without Overwriting Declared Metadata
 * 6. Evidence-Anchored Context Profiles passed across Retrieval, Generation, & SALKG-Guard
 */

const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');
const { callGemini } = require('./aiModelHelper');

// Cache to prevent thrashing on rapid successive calls
const contextCache = new Map();

/**
 * Format timestamp in MM:SS
 */
function formatTime(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Clean & normalize text for basic tokenization
 */
function extractSignificantTokens(text = '') {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of',
    'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'into', 'through',
    'this', 'that', 'these', 'those', 'we', 'you', 'they', 'it', 'what', 'which',
    'today', 'discuss', 'lecture', 'session', 'class', 'talk', 'cover', 'hello',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * Fallback semantic consistency estimator when external LLM is offline or in mock test mode
 */
function estimateConsistencyHeuristic(declaredTitle, declaredSubject, sampleEvidence) {
  const metaTokens = new Set([
    ...extractSignificantTokens(declaredTitle),
    ...extractSignificantTokens(declaredSubject),
  ]);

  if (sampleEvidence.length === 0) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      matchType: 'INSUFFICIENT_DATA',
      inferredSubject: declaredSubject || declaredTitle || 'General Studies',
      confidence: 'LOW',
      explanation: 'No transcript segments or visual slide extractions available yet to establish domain consistency.',
      evidenceRefs: [],
      isProvisional: false,
    };
  }

  const allEvidenceText = sampleEvidence.map((e) => e.text).join(' ');
  const evidenceTokens = extractSignificantTokens(allEvidenceText);

  if (evidenceTokens.length < 8) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      matchType: 'INSUFFICIENT_DATA',
      inferredSubject: declaredSubject || declaredTitle || 'General Studies',
      confidence: 'LOW',
      explanation: 'Evidence volume is too small (< 8 significant terms) to reliably verify domain consistency.',
      evidenceRefs: sampleEvidence.slice(0, 3).map((e) => ({ evidenceId: e.id, timestamp: e.timestamp, type: e.type })),
      isProvisional: false,
    };
  }

  // Check overlap with declared metadata tokens
  let overlapCount = 0;
  for (const token of metaTokens) {
    if (evidenceTokens.includes(token)) overlapCount++;
  }

  const overlapRatio = metaTokens.size > 0 ? overlapCount / metaTokens.size : 0.5;

  // Derive inferred subject name from the most frequent domain-bearing terms
  const freqMap = {};
  evidenceTokens.forEach((t) => { freqMap[t] = (freqMap[t] || 0) + 1; });
  const sortedTerms = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  const inferredSubject = sortedTerms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');

  // Detect broad titles like "Introduction", "Lecture 1", "Session", "Topics"
  const isBroad = /^(lecture|session|class|intro|introduction|overview|topics|part|module)\b/i.test(declaredTitle.trim());

  if (overlapRatio >= 0.25 || isBroad) {
    return {
      status: 'CONSISTENT',
      matchType: isBroad ? 'BROAD_TITLE' : 'MATCH',
      inferredSubject: declaredSubject || declaredTitle,
      confidence: overlapRatio >= 0.5 ? 'HIGH' : 'MEDIUM',
      explanation: `Observed lecture terminology matches declared title "${declaredTitle}" (overlap ratio: ${overlapRatio.toFixed(2)}).`,
      evidenceRefs: sampleEvidence.slice(0, 5).map((e) => ({ evidenceId: e.id, timestamp: e.timestamp, type: e.type, snippet: e.text.slice(0, 100) })),
      isProvisional: false,
    };
  }

  // Strong discrepancy without broadness: POSSIBLE_MISMATCH
  return {
    status: 'POSSIBLE_MISMATCH',
    matchType: 'GENUINE_CONFLICT',
    inferredSubject: inferredSubject || 'Contrasting Subject',
    confidence: 'MEDIUM',
    explanation: `Observed lecture content (${sortedTerms.join(', ')}) diverges from declared title "${declaredTitle}".`,
    evidenceRefs: sampleEvidence.slice(0, 5).map((e) => ({ evidenceId: e.id, timestamp: e.timestamp, type: e.type, snippet: e.text.slice(0, 100) })),
    isProvisional: true,
  };
}

/**
 * Gather representative lecture evidence for domain and topic discovery
 */
async function gatherRepresentativeEvidence(lectureId) {
  const lecture = await get('SELECT * FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  if (!lecture) return { lecture: null, evidence: [], totalEvidenceCount: 0 };

  const resolvedId = lecture.id;
  const segments = await all(
    'SELECT id, start_time, text, speaker_name FROM transcript_segments WHERE lecture_id = ? ORDER BY start_time ASC',
    [resolvedId]
  );
  const board = await all(
    'SELECT id, timestamp, extracted_text, equation, diagram_description FROM board_contents WHERE lecture_id = ? ORDER BY timestamp ASC',
    [resolvedId]
  );
  const screen = await all(
    'SELECT id, timestamp, slide_title, extracted_text, code_snippet FROM screen_contents WHERE lecture_id = ? ORDER BY timestamp ASC',
    [resolvedId]
  );

  const totalEvidenceCount = segments.length + board.length + screen.length;
  const sampleEvidence = [];

  // Sample segments (beginning, middle, and end)
  if (segments.length > 0) {
    const pickIndices = new Set([
      0, 1, 2,
      Math.floor(segments.length / 2),
      Math.floor(segments.length / 2) + 1,
      Math.max(0, segments.length - 2),
      Math.max(0, segments.length - 1),
    ]);
    pickIndices.forEach((idx) => {
      if (segments[idx] && segments[idx].text?.trim()) {
        sampleEvidence.push({
          id: String(segments[idx].id),
          type: 'TRANSCRIPT',
          timestamp: segments[idx].start_time,
          text: `[${formatTime(segments[idx].start_time)}] ${segments[idx].speaker_name || 'Speaker'}: ${segments[idx].text}`,
        });
      }
    });
  }

  // Board items
  board.forEach((b) => {
    const text = `${b.extracted_text || ''} ${b.equation ? `Eq: ${b.equation}` : ''} ${b.diagram_description || ''}`.trim();
    if (text) {
      sampleEvidence.push({
        id: String(b.id),
        type: 'WHITEBOARD',
        timestamp: b.timestamp,
        text: `[${formatTime(b.timestamp)}] Board: ${text}`,
      });
    }
  });

  // Screen items
  screen.forEach((s) => {
    const text = `${s.slide_title || ''} ${s.extracted_text || ''} ${s.code_snippet ? `Code: ${s.code_snippet}` : ''}`.trim();
    if (text) {
      sampleEvidence.push({
        id: String(s.id),
        type: 'SCREEN_SLIDE',
        timestamp: s.timestamp,
        text: `[${formatTime(s.timestamp)}] Slide: ${text}`,
      });
    }
  });

  // Sort chronologically
  sampleEvidence.sort((a, b) => a.timestamp - b.timestamp);

  return {
    lecture,
    evidence: sampleEvidence,
    totalEvidenceCount,
    rawSegments: segments,
    rawBoard: board,
    rawScreen: screen,
  };
}

/**
 * Execute dynamic domain and topic discovery with Metadata-Content Consistency Checking
 */
async function resolveLectureDomainContext(lectureId, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const teacherConfirmedSubject = options.teacherConfirmedSubject || null;

  // 1. Gather representative evidence
  const { lecture, evidence, totalEvidenceCount, rawSegments, rawBoard, rawScreen } =
    await gatherRepresentativeEvidence(lectureId);

  if (!lecture) {
    throw new Error(`Lecture with ID '${lectureId}' not found in database.`);
  }

  const resolvedId = lecture.id;
  const cacheKey = `ctx_${resolvedId}`;

  // 2. Check in-memory cache if evidence hasn't substantially changed
  const cached = contextCache.get(cacheKey);
  if (!forceRefresh && cached && Math.abs(cached.evidenceCountAtResolution - totalEvidenceCount) <= 2) {
    return cached.profile;
  }

  const declaredTitle = lecture.title || 'Untitled Lecture';
  const declaredSubject = lecture.subject || lecture.description || declaredTitle;

  // 3. Run Metadata–Content Consistency Analysis via Gemini or Fallback
  let consistencyReport = null;

  if (evidence.length === 0) {
    consistencyReport = {
      status: 'INSUFFICIENT_EVIDENCE',
      matchType: 'INSUFFICIENT_DATA',
      inferredSubject: declaredSubject,
      confidence: 'LOW',
      explanation: 'No transcript segments or slide extractions available yet to establish domain consistency.',
      evidenceRefs: [],
      isProvisional: false,
    };
  } else {
    try {
      const evidenceSnippet = evidence.map((e) => e.text).slice(0, 16).join('\n');
      const prompt = `You are the LectureLens Academic Domain and Metadata-Content Consistency Engine.
Analyze the teacher's declared lecture metadata against actual spoken and visual lecture evidence.

DECLARED METADATA:
- Lecture Title: "${declaredTitle}"
- Declared Subject / Description: "${declaredSubject}"

ACTUAL OBSERVED LECTURE EVIDENCE (Timestamped):
"""
${evidenceSnippet}
"""

TASK:
1. Infer the primary academic subject/discipline reflected by the actual evidence. DO NOT use hardcoded subject catalogs.
2. Compare the inferred subject with the declared metadata.
3. Determine consistency status:
   - "CONSISTENT": Evidence matches or specializes the declared title/subject.
   - "POSSIBLE_MISMATCH": Evidence clearly contradicts or discusses an unrelated domain.
   - "INSUFFICIENT_EVIDENCE": Evidence is too brief or ambiguous to determine domain.
4. Classify match_type: "MATCH", "BROAD_TITLE", "MULTIDISCIPLINARY", "TOPIC_TRANSITION", "GENUINE_CONFLICT", or "INSUFFICIENT_DATA".
5. Calibrate confidence: "HIGH", "MEDIUM", "LOW", or "UNCALIBRATED".
6. Discover 2 to 4 distinct section-level topics with their learning objectives, key concepts, formulas/processes, and visual needs.

Return ONLY a valid JSON object:
{
  "inferredSubject": "e.g. Relational Databases / Organic Chemistry / Classical Mechanics",
  "consistencyStatus": "CONSISTENT" | "POSSIBLE_MISMATCH" | "INSUFFICIENT_EVIDENCE",
  "matchType": "MATCH" | "BROAD_TITLE" | "MULTIDISCIPLINARY" | "TOPIC_TRANSITION" | "GENUINE_CONFLICT" | "INSUFFICIENT_DATA",
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "UNCALIBRATED",
  "explanation": "Clear analytical reasoning referencing evidence timestamps",
  "evidenceReferences": [
    { "evidenceId": "string", "timestamp": 0.0, "type": "TRANSCRIPT" | "WHITEBOARD" | "SCREEN_SLIDE", "snippet": "brief text" }
  ],
  "sectionTopics": [
    {
      "topicId": "sec_1",
      "heading": "Section Topic Heading",
      "learningObjective": "Clear objective of this section",
      "keyConcepts": ["Concept 1", "Concept 2"],
      "formulasOrProcesses": ["Formula or step description"],
      "visualNeeds": "flowchart" | "transformation" | "timeline" | "coordinate_graph" | "schematic" | "none",
      "approxStartTimestamp": 0.0,
      "approxEndTimestamp": 60.0
    }
  ]
}`;

      const rawJson = await callGemini(async (model) => {
        const res = await model.generateContent(prompt);
        return res.response.text().trim();
      });

      const cleaned = rawJson.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleaned);

      consistencyReport = {
        status: parsed.consistencyStatus || 'CONSISTENT',
        matchType: parsed.matchType || 'MATCH',
        inferredSubject: parsed.inferredSubject || declaredSubject,
        confidence: parsed.confidence || 'MEDIUM',
        explanation: parsed.explanation || 'Analyzed via dynamic semantic model.',
        evidenceRefs: Array.isArray(parsed.evidenceReferences) ? parsed.evidenceReferences : [],
        isProvisional: parsed.consistencyStatus === 'POSSIBLE_MISMATCH',
        sectionTopics: Array.isArray(parsed.sectionTopics) ? parsed.sectionTopics : [],
      };
    } catch (llmErr) {
      // Deterministic rule-free fallback
      consistencyReport = estimateConsistencyHeuristic(declaredTitle, declaredSubject, evidence);
    }
  }

  // 4. Resolve Domain Authority with Safe Provisional Fallback
  // If teacher explicitly confirmed or supplied subject, that takes precedence
  let authoritativeDomain = declaredSubject || declaredTitle;
  let isProvisional = false;

  if (teacherConfirmedSubject) {
    authoritativeDomain = teacherConfirmedSubject;
    consistencyReport.teacherConfirmed = true;
  } else if (consistencyReport.status === 'POSSIBLE_MISMATCH' && consistencyReport.confidence === 'HIGH') {
    // Evidence is strong and contradicts title: use inferred subject provisionally
    authoritativeDomain = consistencyReport.inferredSubject;
    isProvisional = true;
  } else {
    // Preserve declared metadata as authoritative domain
    authoritativeDomain = declaredSubject || declaredTitle;
    isProvisional = false;
  }

  // Fallback section topics if model did not return them
  let sectionTopics = consistencyReport.sectionTopics || [];
  if (sectionTopics.length === 0) {
    if (evidence.length > 0) {
      // Derive dynamic sections from evidence timestamps
      const midpoint = evidence.length > 1 ? evidence[Math.floor(evidence.length / 2)].timestamp : 30;
      sectionTopics = [
        {
          topicId: 'sec_1',
          heading: `${declaredTitle} - Fundamental Concepts`,
          learningObjective: `Understand the core principles and introductory concepts of ${authoritativeDomain}.`,
          keyConcepts: [declaredTitle],
          formulasOrProcesses: [],
          visualNeeds: 'flowchart',
          approxStartTimestamp: 0.0,
          approxEndTimestamp: midpoint,
        },
        {
          topicId: 'sec_2',
          heading: `${declaredTitle} - Detailed Mechanics & Application`,
          learningObjective: `Apply analytical methods and techniques to ${authoritativeDomain} problem solving.`,
          keyConcepts: [authoritativeDomain],
          formulasOrProcesses: [],
          visualNeeds: 'transformation',
          approxStartTimestamp: midpoint,
          approxEndTimestamp: midpoint + 60,
        },
      ];
    } else {
      sectionTopics = [
        {
          topicId: 'sec_overview',
          heading: `${declaredTitle} - Lecture Overview`,
          learningObjective: `Comprehend the scope and foundational framework of ${authoritativeDomain}.`,
          keyConcepts: [authoritativeDomain],
          formulasOrProcesses: [],
          visualNeeds: 'flowchart',
          approxStartTimestamp: 0.0,
          approxEndTimestamp: 60.0,
        },
      ];
    }
  }

  // 5. Construct Complete Context Profile
  const profile = {
    lectureId: resolvedId,
    declaredTitle,
    declaredSubject,
    authoritativeDomain,
    inferredSubject: consistencyReport.inferredSubject,
    consistencyStatus: consistencyReport.status,
    matchType: consistencyReport.matchType,
    confidence: consistencyReport.confidence,
    isProvisional,
    explanation: consistencyReport.explanation,
    evidenceReferences: consistencyReport.evidenceRefs,
    sectionTopics,
    resolvedAt: new Date().toISOString(),
    evidenceCountAtResolution: totalEvidenceCount,
  };

  // 6. Persist to SQLite metadata_consistency_reports
  try {
    const reportId = 'mcr_' + uuidv4().slice(0, 8);
    await run(
      `INSERT INTO metadata_consistency_reports (
        id, lecture_id, declared_title, declared_subject, inferred_subject,
        consistency_status, match_type, confidence, explanation, evidence_refs_json,
        is_provisional, teacher_confirmed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        reportId,
        resolvedId,
        declaredTitle,
        declaredSubject,
        consistencyReport.inferredSubject,
        consistencyReport.status,
        consistencyReport.matchType,
        consistencyReport.confidence,
        consistencyReport.explanation,
        JSON.stringify(consistencyReport.evidenceRefs || []),
        isProvisional ? 1 : 0,
        teacherConfirmedSubject ? 1 : 0,
      ]
    );

    // Save profile to lectures table
    await run(
      `UPDATE lectures SET domain_context_json = ? WHERE id = ?`,
      [JSON.stringify(profile), resolvedId]
    );
  } catch (dbErr) {
    console.warn(`[DomainContextService] SQLite persistence warning for ${resolvedId}:`, dbErr.message);
  }

  // 7. Store in memory cache
  contextCache.set(cacheKey, {
    evidenceCountAtResolution: totalEvidenceCount,
    profile,
  });

  return profile;
}

/**
 * Format domain context for insertion into Gemini prompts
 */
function formatDomainContextForPrompt(domainContext, currentSection = null) {
  if (!domainContext) return '';

  let out = `AUTHORITATIVE ACADEMIC DOMAIN CONTEXT:
- Lecture Title: "${domainContext.declaredTitle}"
- Primary Domain: "${domainContext.authoritativeDomain}"
- Consistency Assessment: ${domainContext.consistencyStatus} (${domainContext.matchType}, Confidence: ${domainContext.confidence})
${domainContext.isProvisional ? `> [NOTE: Content domain provisionally inferred from lecture materials without overwriting declared title]\n` : ''}`;

  if (currentSection) {
    out += `\nCURRENT SECTION PROFILE:
- Section Topic: "${currentSection.heading || currentSection.topic || 'General Lecture Segment'}"
- Section Learning Objective: "${currentSection.learningObjective || 'Master the concepts presented in this section'}"
${currentSection.keyConcepts ? `- Key Concepts: ${currentSection.keyConcepts.join(', ')}\n` : ''}`;
  }

  out += `\nDISCIPLINE GROUNDING RULES:
1. You must maintain strict semantic alignment with the primary domain "${domainContext.authoritativeDomain}".
2. Do NOT introduce terminology, formulas, or diagrams from unrelated disciplines.
3. Distinguish facts explicitly taught in the lecture from supplementary illustrative examples. Newly created examples MUST be relevant and labeled as illustrative.\n`;

  return out;
}

module.exports = {
  resolveLectureDomainContext,
  formatDomainContextForPrompt,
  estimateConsistencyHeuristic,
  extractSignificantTokens,
};
