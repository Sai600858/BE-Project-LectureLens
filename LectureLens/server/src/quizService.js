const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');
const { gatherLectureMultimodalContext } = require('./summaryService');
const { callGemini } = require('./aiModelHelper');
const { validateWithSALKGGuard } = require('./salkgGuardService');
const { resolveLectureDomainContext, formatDomainContextForPrompt } = require('./domainContextService');

function parseJsonSafe(rawText) {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```$/m, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {}
    }
    return null;
  }
}

/**
 * Generate AI Quiz for a lecture (Section 20)
 */
async function generateQuiz(lectureId) {
  const ctx = await gatherLectureMultimodalContext(lectureId);
  const quizId = 'quiz_' + uuidv4().slice(0, 8);

  // Check if a quiz already exists
  const existingQuiz = await get('SELECT * FROM quizzes WHERE lecture_id = ?', [lectureId]);
  if (existingQuiz) {
    const existingQuestions = await all('SELECT * FROM quiz_questions WHERE quiz_id = ?', [existingQuiz.id]);
    if (existingQuestions.length > 0) {
      return {
        quiz: existingQuiz,
        questions: existingQuestions.map((q) => ({
          ...q,
          options: q.options_json ? JSON.parse(q.options_json) : [],
        })),
      };
    }
  }

  let generatedQuestions = [];

  let domainContext = null;
  try {
    domainContext = await resolveLectureDomainContext(lectureId);
  } catch (ctxErr) {
    console.warn('[Quiz] Domain context resolution notice:', ctxErr.message);
  }

  try {
    const domainHeader = formatDomainContextForPrompt(domainContext);
    const prompt = `You are an expert academic examiner for LectureLens.
Create a comprehensive 5-8 question quiz evaluating student understanding of this lecture.
Include a variety of question types: 'MCQ', 'TRUE_FALSE', 'FILL_BLANK', and 'SHORT_ANSWER'.
Return ONLY valid raw JSON without markdown:
[
  {
    "questionText": "Question wording",
    "type": "MCQ",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Clear explanation why this is correct",
    "difficulty": "Medium",
    "topic": "Topic Name"
  },
  {
    "questionText": "Statement to evaluate",
    "type": "TRUE_FALSE",
    "options": ["True", "False"],
    "correctAnswer": "True",
    "explanation": "Explanation",
    "difficulty": "Easy",
    "topic": "Topic Name"
  }
]

Difficulty levels must be one of: 'Easy', 'Medium', 'Hard'.
For FILL_BLANK and SHORT_ANSWER, options can be empty array [].

${domainHeader ? `${domainHeader}\n` : ''}
Lecture Title: "${ctx.lecture?.title || 'Lecture'}"
Audio Transcript:
"""
${ctx.transcriptText.slice(0, 8000)}
"""

Board & Slide Information:
"""
${ctx.boardNotes || ''}
${ctx.screenNotes || ''}
"""`;

    const rawText = await callGemini(async (model) => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    const parsed = parseJsonSafe(rawText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      generatedQuestions = parsed;
    }
  } catch (err) {
    console.warn('[Quiz Generator] Gemini error, using fallback questions:', err.message);
  }

  if (generatedQuestions.length === 0) {
    const topName = domainContext?.authoritativeDomain || ctx.lecture?.title || 'this session';
    generatedQuestions = [
      {
        questionText: `What was the primary focus of the lecture "${topName}"?`,
        type: 'MCQ',
        options: [
          `Core theoretical foundations and applications of ${topName}`,
          'Database optimization exclusively',
          'Network hardware assembly',
          'Compiler front-end construction',
        ],
        correctAnswer: `Core theoretical foundations and applications of ${topName}`,
        explanation: 'The session laid out the core architecture, mathematical invariants, and practical trade-offs.',
        difficulty: 'Easy',
        topic: 'Foundations',
      },
      {
        questionText: `The concepts presented in ${topName} require rigorous validation and domain consistency.`,
        type: 'TRUE_FALSE',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'Educational systems and scientific derivations require explicit boundary handling and invariant consistency.',
        difficulty: 'Easy',
        topic: 'Reliability',
      },
      {
        questionText: `Explain the most critical concept or method discussed during the lecture on ${topName}.`,
        type: 'SHORT_ANSWER',
        options: [],
        correctAnswer: `Key principles and methods of ${topName}.`,
        explanation: 'Review the lecture overview, key formulas, and section takeaways.',
        difficulty: 'Medium',
        topic: 'Core Concepts',
      },
    ];
  }

  // Validate with SALKG-Guard
  let validationReport = null;
  try {
    const guardRes = await validateWithSALKGGuard({
      lectureId,
      generatedContent: JSON.stringify(generatedQuestions),
      contentType: 'quiz',
      domain: domainContext?.authoritativeDomain,
    });
    validationReport = guardRes.report;
  } catch (guardErr) {
    console.warn('[QuizGenerator] SALKG-Guard non-blocking error:', guardErr.message);
  }

  // Insert quiz header
  await run('INSERT INTO quizzes (id, lecture_id, title) VALUES (?, ?, ?)', [
    quizId,
    lectureId,
    `${ctx.lecture?.title || 'Lecture'} Assessment Quiz`,
  ]);

  // Insert quiz questions
  for (const q of generatedQuestions) {
    const qId = 'qq_' + uuidv4().slice(0, 8);
    const qType = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'].includes(q.type) ? q.type : 'MCQ';
    const diff = ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium';

    await run(
      `INSERT INTO quiz_questions (id, quiz_id, question_text, type, options_json, correct_answer, explanation, difficulty, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qId,
        quizId,
        q.questionText,
        qType,
        JSON.stringify(q.options || []),
        q.correctAnswer,
        q.explanation || '',
        diff,
        q.topic || 'General',
      ]
    );
  }

  const questions = await all('SELECT * FROM quiz_questions WHERE quiz_id = ?', [quizId]);
  return {
    quiz: { id: quizId, lecture_id: lectureId, title: `${ctx.lecture?.title || 'Lecture'} Assessment Quiz` },
    questions: questions.map((q) => ({
      ...q,
      options: q.options_json ? JSON.parse(q.options_json) : [],
    })),
    validationReport,
  };
}

/**
 * Submit Quiz Answers and Calculate Score + Weak Topics
 */
async function submitQuizAttempt({ quizId, userId, answers = {} }) {
  const questions = await all('SELECT * FROM quiz_questions WHERE quiz_id = ?', [quizId]);
  if (!questions || questions.length === 0) {
    throw new Error('No quiz questions found');
  }

  let score = 0;
  const weakTopics = new Set();
  const results = [];

  for (const q of questions) {
    const studentAnswer = (answers[q.id] || '').trim().toLowerCase();
    const correctAnswer = (q.correct_answer || '').trim().toLowerCase();

    const isCorrect = studentAnswer === correctAnswer || (q.type === 'SHORT_ANSWER' && studentAnswer.length > 5);

    if (isCorrect) {
      score += 1;
    } else {
      if (q.topic) weakTopics.add(q.topic);
    }

    results.push({
      questionId: q.id,
      questionText: q.question_text,
      userAnswer: answers[q.id] || '',
      correctAnswer: q.correct_answer,
      isCorrect,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic: q.topic,
    });
  }

  const attemptId = 'att_' + uuidv4().slice(0, 8);
  const weakTopicsArray = Array.from(weakTopics);

  await run(
    `INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total_questions, answers_json, weak_topics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      quizId,
      userId,
      score,
      questions.length,
      JSON.stringify(answers),
      JSON.stringify(weakTopicsArray),
    ]
  );

  return {
    attemptId,
    score,
    totalQuestions: questions.length,
    percentage: Math.round((score / questions.length) * 100),
    weakTopics: weakTopicsArray,
    results,
  };
}

/**
 * Generate AI Flashcards (Section 21)
 */
async function generateFlashcards(lectureId) {
  const existing = await all('SELECT * FROM flashcards WHERE lecture_id = ?', [lectureId]);
  if (existing && existing.length > 0) {
    return existing;
  }

  const ctx = await gatherLectureMultimodalContext(lectureId);
  let flashcardData = [];

  let domainContext = null;
  try {
    domainContext = await resolveLectureDomainContext(lectureId);
  } catch (ctxErr) {
    console.warn('[Flashcards] Domain context resolution notice:', ctxErr.message);
  }

  try {
    const domainHeader = formatDomainContextForPrompt(domainContext);
    const prompt = `You are an expert spaced-repetition flashcard creator for LectureLens.
Create 6-10 high-value study flashcards from this lecture content.
Return ONLY valid raw JSON:
[
  {
    "question": "Front of card (prompt, definition request, formula, or concept)",
    "answer": "Back of card (concise, precise explanation)",
    "topic": "Topic Name",
    "difficulty": "Easy"
  }
]
Difficulty must be one of: 'Easy', 'Medium', 'Hard'.

${domainHeader ? `${domainHeader}\n` : ''}
Lecture Title: "${ctx.lecture?.title || 'Lecture'}"
Transcript:
"""
${ctx.transcriptText.slice(0, 8000)}
"""

Board & Slide Info:
"""
${ctx.boardNotes || ''}
${ctx.screenNotes || ''}
"""`;

    const rawText = await callGemini(async (model) => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    const parsed = parseJsonSafe(rawText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      flashcardData = parsed;
    }
  } catch (err) {
    console.warn('[Flashcards] Gemini error:', err.message);
  }

  if (flashcardData.length === 0) {
    const topName = domainContext?.authoritativeDomain || ctx.lecture?.title || 'this lecture';
    flashcardData = [
      {
        question: `What is the core focus of the lecture on ${topName}?`,
        answer: `Comprehensive academic foundations, analytical methods, and applications of ${topName}.`,
        topic: 'Foundations',
        difficulty: 'Easy',
      },
      {
        question: `What fundamental invariant or rule governs ${topName}?`,
        answer: 'Rigorous domain consistency and adherence to empirical lecture evidence.',
        topic: 'Principles',
        difficulty: 'Medium',
      },
      {
        question: `How are problem-solving derivations executed in ${topName}?`,
        answer: 'Through structured step-by-step reasoning verified against multimodal lecture records.',
        topic: 'Methodology',
        difficulty: 'Hard',
      },
    ];
  }

  // Validate with SALKG-Guard
  let validationReport = null;
  try {
    const guardRes = await validateWithSALKGGuard({
      lectureId,
      generatedContent: JSON.stringify(flashcardData),
      contentType: 'flashcard',
      domain: domainContext?.authoritativeDomain,
    });
    validationReport = guardRes.report;
  } catch (guardErr) {
    console.warn('[FlashcardGenerator] SALKG-Guard non-blocking error:', guardErr.message);
  }

  for (const fc of flashcardData) {
    const fcId = 'fc_' + uuidv4().slice(0, 8);
    const diff = ['Easy', 'Medium', 'Hard'].includes(fc.difficulty) ? fc.difficulty : 'Medium';
    await run(
      `INSERT INTO flashcards (id, lecture_id, question, answer, topic, difficulty)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fcId, lectureId, fc.question, fc.answer, fc.topic || 'General', diff]
    );
  }

  return await all('SELECT * FROM flashcards WHERE lecture_id = ?', [lectureId]);
}

/**
 * Update flashcard progress
 */
async function updateFlashcardProgress({ flashcardId, userId, status }) {
  const validStatus = ['unlearned', 'learned', 'difficult'];
  const newStatus = validStatus.includes(status) ? status : 'learned';

  const existing = await get('SELECT id FROM flashcard_progress WHERE flashcard_id = ? AND user_id = ?', [
    flashcardId,
    userId,
  ]);

  if (existing) {
    await run(
      'UPDATE flashcard_progress SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, existing.id]
    );
  } else {
    const id = 'fcp_' + uuidv4().slice(0, 8);
    await run(
      'INSERT INTO flashcard_progress (id, flashcard_id, user_id, status) VALUES (?, ?, ?, ?)',
      [id, flashcardId, userId, newStatus]
    );
  }

  return { success: true, status: newStatus };
}

module.exports = {
  generateQuiz,
  submitQuizAttempt,
  generateFlashcards,
  updateFlashcardProgress,
};
