const { get, all } = require('./db');
const { callGemini } = require('./aiModelHelper');
const { getOrComputeSALKG, formatSALKGContextForPrompt } = require('./salkgAdapter');
const { runGuardedGeneration } = require('./salkgGuardService');
const { resolveLectureDomainContext, formatDomainContextForPrompt } = require('./domainContextService');

// Minimal grammatical filler stop words
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their', 'our'
]);

function formatOffset(seconds = 0) {
  const sNum = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(sNum / 60);
  const s = Math.floor(sNum % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(/[^\d:]/g, '');
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

/**
 * Check if the question is an overview/thematic request
 */
function isOverviewQuestion(query) {
  const qLower = (query || '').toLowerCase();
  return (
    qLower.includes('summar') ||
    qLower.includes('overview') ||
    qLower.includes('main concept') ||
    qLower.includes('main point') ||
    qLower.includes('what was discuss') ||
    qLower.includes('what did the lecture cover') ||
    qLower.includes('what is this lecture about') ||
    qLower.includes('what happened') ||
    qLower.includes('who spoke') ||
    qLower.includes('all topic') ||
    qLower.includes('topics cover') ||
    qLower.includes('key takeaway')
  );
}

/**
 * Perform keyword & semantic scoring over transcript segments and multimodal notes
 */
function searchRelevantChunks(query, segments = [], boardContents = [], screenContents = [], limit = 10, salkgResult = null) {
  const rawQuery = (query || '').trim().toLowerCase();
  const queryClean = rawQuery.replace(/[^a-z0-9\s]/g, ' ');
  const queryWords = queryClean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const scoredItems = [];

  // Index SALKG alignment matches by segment ID
  const salkgMatches = salkgResult?.alignment?.matches || [];
  const salkgMatchMap = new Map();
  salkgMatches.forEach((m) => {
    if (m.transcript_id) salkgMatchMap.set(String(m.transcript_id), m);
  });

  // 1. Transcript segments
  for (const seg of segments) {
    if (!seg.text || !seg.text.trim()) continue;
    const textLower = seg.text.toLowerCase();
    const speakerLower = (seg.speaker_name || '').toLowerCase();
    let score = 0;

    // Full phrase exact match
    if (queryClean.length > 3 && textLower.includes(queryClean)) {
      score += 15;
    }

    // Word boundary & substring matches
    for (const word of queryWords) {
      if (speakerLower.includes(word)) {
        score += 6;
      }
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(textLower)) {
        score += 4;
      } else if (textLower.includes(word)) {
        score += 2;
      }
    }

    // SALKG Multimodal Alignment Signal: boost if speech was verified to be grounded in a slide
    const match = salkgMatchMap.get(String(seg.id));
    if (score > 0 && match && match.status === 'accepted') {
      score += 5; // Boost grounded cross-modal evidence
    }

    if (score > 0) {
      scoredItems.push({
        sourceType: 'TRANSCRIPT',
        speaker: seg.speaker_name || 'Speaker',
        text: seg.text,
        timestamp: seg.start_time || 0,
        score,
        salkgMatch: match || null,
      });
    }
  }

  // 2. Whiteboard contents
  for (const board of boardContents) {
    const textPart = board.extracted_text || '';
    const eqPart = board.equation || '';
    const diagPart = board.diagram_description || '';
    const combined = `${textPart} ${eqPart} ${diagPart}`.toLowerCase();
    let score = 0;

    if (queryClean.length > 3 && combined.includes(queryClean)) {
      score += 15;
    }

    for (const word of queryWords) {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(combined)) {
        score += 5;
      } else if (combined.includes(word)) {
        score += 2;
      }
    }

    if (score > 0) {
      scoredItems.push({
        sourceType: 'BOARD',
        speaker: 'Whiteboard Note',
        text: `Board Text: ${textPart}${eqPart ? ` | Equation: ${eqPart}` : ''}${diagPart ? ` | Diagram: ${diagPart}` : ''}`,
        timestamp: board.timestamp || 0,
        score,
      });
    }
  }

  // 3. Screen contents (slides, code)
  for (const scr of screenContents) {
    const titlePart = scr.slide_title || '';
    const textPart = scr.extracted_text || '';
    const codePart = scr.code_snippet || '';
    const combined = `${titlePart} ${textPart} ${codePart}`.toLowerCase();
    let score = 0;

    if (queryClean.length > 3 && combined.includes(queryClean)) {
      score += 15;
    }

    for (const word of queryWords) {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(combined)) {
        score += 5;
      } else if (combined.includes(word)) {
        score += 2;
      }
    }

    if (score > 0) {
      scoredItems.push({
        sourceType: 'SLIDE',
        speaker: 'Slide Presentation',
        text: `Slide: ${titlePart}${textPart ? ` | Content: ${textPart}` : ''}${codePart ? ` | Code: ${codePart}` : ''}`,
        timestamp: scr.timestamp || 0,
        score,
      });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, limit);
}

/**
 * Ask This Lecture (Grounded RAG Pipeline)
 */
async function askLecture(lectureId, question) {
  if (!question || !question.trim()) {
    throw new Error('Question cannot be empty');
  }

  const cleanQuestion = question.trim();

  // 1. Resolve lecture
  const lecture = await get('SELECT * FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  if (!lecture) {
    throw new Error('Lecture session not found');
  }
  const resolvedLectureId = lecture.id;
  const resolvedRoomId = lecture.room_id || resolvedLectureId;

  // 2. Fetch transcript segments
  let segments = await all(
    'SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
    [resolvedLectureId, resolvedRoomId]
  );

  // 3. Fetch master transcript row
  const transcriptRecord = await get(
    'SELECT * FROM transcripts WHERE lecture_id = ? OR lecture_id = ?',
    [resolvedLectureId, resolvedRoomId]
  );

  // If segments table is empty but transcripts has full_text, synthesize segments
  if ((!segments || segments.length === 0) && transcriptRecord && transcriptRecord.full_text && transcriptRecord.full_text.trim()) {
    const lines = transcriptRecord.full_text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let offset = 0;
    segments = lines.map((line) => {
      const seg = {
        speaker_name: lecture.host_name || 'Speaker',
        text: line,
        start_time: offset,
        end_time: offset + 5,
      };
      offset += 5;
      return seg;
    });
  }

  // 4. Fetch board notes & screen captures
  const boardContents = await all(
    'SELECT * FROM board_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC',
    [resolvedLectureId, resolvedRoomId]
  );
  const screenContents = await all(
    'SELECT * FROM screen_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC',
    [resolvedLectureId, resolvedRoomId]
  );

  // 5. Fetch summary if available
  const summaryRecord = await get(
    'SELECT * FROM summaries WHERE lecture_id = ? OR lecture_id = ?',
    [resolvedLectureId, resolvedRoomId]
  );

  const hasAnyTranscript = segments && segments.length > 0;
  const hasBoardNotes = boardContents && boardContents.length > 0;
  const hasScreenNotes = screenContents && screenContents.length > 0;
  const hasSummary = !!(summaryRecord && (summaryRecord.short_summary || summaryRecord.detailed_summary));

  // If truly no lecture content exists at all
  if (!hasAnyTranscript && !hasBoardNotes && !hasScreenNotes && !hasSummary) {
    return {
      question: cleanQuestion,
      answer: `No transcription or lecture materials have been recorded for "${lecture.title}" yet. To ask questions about a lecture, ensure that speech-to-text live transcription is started during the lecture session, or review a lecture with recorded transcription.`,
      relevantTimestamp: null,
      timestampSeconds: null,
      sources: [],
    };
  }

  // 6. Retrieve SALKG Alignment and Knowledge Graph signals
  let salkgResult = null;
  try {
    salkgResult = await getOrComputeSALKG(resolvedLectureId);
  } catch (salkgErr) {
    console.warn('[RAG Service] SALKG retrieval notice:', salkgErr.message);
  }

  // 7. Search relevant chunks with SALKG cross-modal alignment boosts
  const isOverview = isOverviewQuestion(cleanQuestion);
  const scoredChunks = searchRelevantChunks(cleanQuestion, segments, boardContents, screenContents, 10, salkgResult);
  const salkgContext = salkgResult ? formatSALKGContextForPrompt(salkgResult) : '';

  // 8. Assemble chronological timeline & multimodal context
  let timelineContext = '';
  if (hasAnyTranscript) {
    if (segments.length <= 50 || isOverview || scoredChunks.length === 0) {
      timelineContext = segments
        .map((s) => `[Timestamp ${formatOffset(s.start_time)}] ${s.speaker_name || 'Speaker'}: ${s.text}`)
        .join('\n');
    } else {
      const topTimes = new Set(scoredChunks.map((c) => c.timestamp));
      const relevantSegs = segments.filter((s) => {
        if (topTimes.has(s.start_time)) return true;
        return scoredChunks.some((c) => Math.abs(c.timestamp - s.start_time) <= 15);
      });
      timelineContext = relevantSegs
        .map((s) => `[Timestamp ${formatOffset(s.start_time)}] ${s.speaker_name || 'Speaker'}: ${s.text}`)
        .join('\n');
    }
  }

  let boardContext = '';
  if (hasBoardNotes) {
    boardContext = boardContents
      .map(
        (b) =>
          `[Timestamp ${formatOffset(b.timestamp)}] Whiteboard: ${b.extracted_text || ''}${b.equation ? ` | Equation: ${b.equation}` : ''}${b.diagram_description ? ` | Diagram: ${b.diagram_description}` : ''}`
      )
      .join('\n');
  }

  let screenContext = '';
  if (hasScreenNotes) {
    screenContext = screenContents
      .map(
        (s) =>
          `[Timestamp ${formatOffset(s.timestamp)}] Slide: ${s.slide_title || ''}${s.extracted_text ? ` | Content: ${s.extracted_text}` : ''}${s.code_snippet ? ` | Code: ${s.code_snippet}` : ''}`
      )
      .join('\n');
  }

  let summaryContext = '';
  if (summaryRecord) {
    if (summaryRecord.short_summary) summaryContext += `Executive Summary:\n${summaryRecord.short_summary}\n`;
    if (summaryRecord.key_takeaways_json) {
      try {
        const takeaways = JSON.parse(summaryRecord.key_takeaways_json);
        if (Array.isArray(takeaways)) {
          summaryContext += `Key Takeaways:\n${takeaways.map((t) => `• ${t}`).join('\n')}\n`;
        }
      } catch (e) {}
    }
  }

  // 9. Resolve Metadata-Driven Domain Context
  let domainContext = null;
  try {
    domainContext = await resolveLectureDomainContext(resolvedLectureId);
  } catch (ctxErr) {
    console.warn('[RAG Service] Domain context resolution notice:', ctxErr.message);
  }

  // 10. Generate answer using Gemini with SALKG-Guard Validation and Targeted Correction Loop
  try {
    const domainHeader = formatDomainContextForPrompt(domainContext);
    const basePrompt = `You are the LectureLens AI Tutor answering a student's question about the university lecture "${lecture.title}".
Instructor: ${lecture.host_name || 'Instructor'}

${domainHeader ? `${domainHeader}\n` : ''}
${salkgContext ? `AUTHENTIC SALKG GROUNDED KNOWLEDGE GRAPH & MULTIMODAL ALIGNMENTS:\n"""\n${salkgContext}\n"""\n` : ''}
${timelineContext ? `LECTURE TRANSCRIPT & SPOKEN DIALOGUE:\n"""\n${timelineContext}\n"""\n` : ''}
${boardContext ? `WHITEBOARD NOTES & EQUATIONS:\n"""\n${boardContext}\n"""\n` : ''}
${screenContext ? `SLIDE PRESENTATION CONTENT:\n"""\n${screenContext}\n"""\n` : ''}
${summaryContext ? `EXISTING LECTURE SUMMARY:\n"""\n${summaryContext}\n"""\n` : ''}

STUDENT QUESTION: "${cleanQuestion}"

CRITICAL INSTRUCTIONS:
1. Base your answer PRIMARILY AND STRICTLY on the provided lecture transcript, spoken dialogue, whiteboard notes, and slides above.
2. If the student asks what was discussed, what the lecture is about, main concepts, or for a summary: provide a structured, thorough, and clear explanation of what was taught and spoken.
3. If the student asks about a specific topic, explain what the speaker(s) said about that topic in the lecture.
4. Attribute statements to who said them (e.g., "Prof. Alan Turing stated...", "Ada Lovelace asked...", etc.).
5. Cite exact lecture timestamps whenever citing or referencing a point (e.g. "[Timestamp 0:25]" or "At 0:12"). ONLY cite timestamps that actually appear in the transcript above.
6. If the student asks about a concept or subject that was NOT mentioned or covered anywhere in this lecture transcript or materials:
   DO NOT make up information. Explicitly state:
   "This topic was not covered in this lecture. Based on the transcript, this lecture focused on [briefly mention actual topics covered in the lecture]."
7. Be encouraging, clear, pedagogical, and accurate. Format your answer with clean markdown bullet points or bold headings.`;

    const guardedResult = await runGuardedGeneration({
      lectureId: resolvedLectureId,
      contentType: 'rag_answer',
      domainHint: domainContext?.authoritativeDomain || salkgResult?.inferred_subject,
      maxRetries: 2,
      generateFn: async (correctionFeedback) => {
        let fullPrompt = basePrompt;
        if (correctionFeedback) {
          fullPrompt += `\n\nCRITICAL CORRECTION REQUIRED:\nYour previous draft had the following verification defect: "${correctionFeedback}". Please correct this error. Base your revised answer ONLY on the provided lecture materials. DO NOT invent facts.`;
        }
        return await callGemini(async (model) => {
          const result = await model.generateContent(fullPrompt);
          return result.response.text().trim();
        });
      },
      onAbstain: (report) => {
        return `This topic was not covered or supported by the evidence in this lecture. Based on the lecture transcript and materials, this session focused on ${domainContext?.authoritativeDomain || salkgResult?.inferred_subject || 'the course curriculum'}. To prevent factual hallucinations, the system abstains from generating unverified claims.`;
      },
    });

    const answer = guardedResult.artifact;

    // Extract cited timestamp from answer or fallback to top scored / first segment
    let topTimestamp = null;
    let topTimestampSec = null;

    const tsMatch = answer.match(/\[(?:Timestamp:?\s*)?(\d{1,2}:\d{2})\]/i) || answer.match(/\b(?:timestamp|at)\s+(\d{1,2}:\d{2})\b/i);
    if (tsMatch && tsMatch[1]) {
      topTimestamp = tsMatch[1];
      topTimestampSec = parseTimeToSeconds(tsMatch[1]);
    } else if (scoredChunks.length > 0) {
      topTimestamp = formatOffset(scoredChunks[0].timestamp);
      topTimestampSec = scoredChunks[0].timestamp;
    } else if (segments && segments.length > 0) {
      topTimestamp = formatOffset(segments[0].start_time);
      topTimestampSec = segments[0].start_time;
    }

    // Determine sources to return
    let sources = [];
    if (scoredChunks.length > 0) {
      sources = scoredChunks.map((c) => ({
        type: c.sourceType,
        timestamp: formatOffset(c.timestamp),
        timestampSeconds: c.timestamp,
        snippet: c.text.slice(0, 140),
        salkgMatch: c.salkgMatch ? {
          visualId: c.salkgMatch.visual_id,
          confidence: c.salkgMatch.calibrated_confidence,
          status: c.salkgMatch.status,
        } : null,
      }));
    } else if (segments && segments.length > 0) {
      sources = segments.slice(0, 5).map((s) => ({
        type: 'TRANSCRIPT',
        timestamp: formatOffset(s.start_time),
        timestampSeconds: s.start_time,
        snippet: s.text.slice(0, 140),
      }));
    }

    return {
      question: cleanQuestion,
      answer,
      relevantTimestamp: topTimestamp,
      timestampSeconds: topTimestampSec,
      sources,
      salkgGrounding: {
        inferredSubject: salkgResult?.inferred_subject || 'unknown',
        alignmentCoverage: salkgResult?.alignment?.coverage || 0.0,
        acceptedEdgesCount: (salkgResult?.knowledge_graph?.edges || []).filter((e) => e.validation_status === 'accepted').length,
      },
      validationReport: guardedResult.report,
      guardDecision: guardedResult.decision,
    };
  } catch (err) {
    console.warn('[RAG Service] Gemini call failed, generating grounded fallback:', err.message);
  }

  // 9. Intelligent fallback if Gemini API is temporarily unavailable
  let fallbackAnswer = '';
  let fallbackTimestamp = null;
  let fallbackTimestampSec = null;

  const metaWords = new Set(['what', 'did', 'say', 'says', 'said', 'tell', 'ask', 'asked', 'professor', 'prof', 'teacher', 'instructor', 'explain', 'mention', 'talk', 'about', 'can', 'you', 'the', 'how', 'why', 'who']);
  const topicWords = cleanQuestion.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !metaWords.has(w) && !STOP_WORDS.has(w));

  const allLectureText = (
    segments.map((s) => s.text).join(' ') + ' ' +
    boardContents.map((b) => (b.extracted_text || '') + ' ' + (b.equation || '')).join(' ') + ' ' +
    screenContents.map((s) => (s.slide_title || '') + ' ' + (s.extracted_text || '')).join(' ')
  ).toLowerCase();

  const isRelevantTopic = isOverview || topicWords.length === 0 || topicWords.some((w) => allLectureText.includes(w));

  if (!isRelevantTopic) {
    fallbackAnswer = `This topic was not covered or supported by the evidence in this lecture. Based on the transcript, this lecture focused on "${lecture.title}". To prevent hallucinations, the system abstains from answering unverified questions.`;
  } else if (scoredChunks.length > 0) {
    const top = scoredChunks[0];
    fallbackTimestamp = formatOffset(top.timestamp);
    fallbackTimestampSec = top.timestamp;
    fallbackAnswer = `Based on the lecture discussion around [Timestamp ${fallbackTimestamp}], ${top.speaker} stated: "${top.text}"`;
  } else if (segments && segments.length > 0) {
    fallbackTimestamp = formatOffset(segments[0].start_time);
    fallbackTimestampSec = segments[0].start_time;
    fallbackAnswer = `Based on the lecture transcription, the lecture began with [Timestamp ${fallbackTimestamp}] ${segments[0].speaker_name || 'Speaker'}: "${segments[0].text}"`;
  } else {
    fallbackAnswer = `This topic was not covered in this lecture. Based on the transcript, this lecture focused on "${lecture.title}".`;
  }

  return {
    question: cleanQuestion,
    answer: fallbackAnswer,
    relevantTimestamp: fallbackTimestamp,
    timestampSeconds: fallbackTimestampSec,
    sources: scoredChunks.slice(0, 5).map((c) => ({
      type: c.sourceType,
      timestamp: formatOffset(c.timestamp),
      timestampSeconds: c.timestamp,
      snippet: c.text.slice(0, 140),
    })),
  };
}

module.exports = {
  askLecture,
  searchRelevantChunks,
};
