package com.lecturelens.ai;

import com.lecturelens.dto.*;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class MockAiProvider implements AiProvider {

    private boolean enabled = false;
    private boolean simulateQuotaError = false;
    private boolean simulateAuthError = false;
    private boolean simulateMalformedJson = false;
    private boolean simulateTimeout = false;

    @Override
    public String getName() {
        return "mock";
    }

    @Override
    public boolean isAvailable() {
        return enabled;
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public void setSimulateQuotaError(boolean simulateQuotaError) { this.simulateQuotaError = simulateQuotaError; }
    public void setSimulateAuthError(boolean simulateAuthError) { this.simulateAuthError = simulateAuthError; }
    public void setSimulateMalformedJson(boolean simulateMalformedJson) { this.simulateMalformedJson = simulateMalformedJson; }
    public void setSimulateTimeout(boolean simulateTimeout) { this.simulateTimeout = simulateTimeout; }

    public void reset() {
        this.enabled = false;
        this.simulateQuotaError = false;
        this.simulateAuthError = false;
        this.simulateMalformedJson = false;
        this.simulateTimeout = false;
    }

    private void checkSimulatedErrors() {
        if (simulateQuotaError) {
            throw new RuntimeException("HTTP 429: Resource has been exhausted (quota exceeded).");
        }
        if (simulateAuthError) {
            throw new RuntimeException("HTTP 401: API_KEY_INVALID unauthorized.");
        }
        if (simulateTimeout) {
            throw new RuntimeException("Read timed out after 30000ms.");
        }
        if (simulateMalformedJson) {
            throw new RuntimeException("Malformed JSON: unexpected token at position 12");
        }
    }

    @Override
    public AiSummaryResult generateSummary(AiLectureContext context) {
        checkSimulatedErrors();

        AiSummaryResult result = new AiSummaryResult();
        result.setProviderName(getName());
        result.setFallback(false);
        result.setShortSummary("• Mock executive summary bullet 1.\n• Mock executive summary bullet 2.");
        result.setDetailedSummary("Mock comprehensive detailed synthesis for " + context.getLectureTitle() + ".");

        List<KeyConceptDto> concepts = new ArrayList<>();
        concepts.add(new KeyConceptDto("Mock Concept Alpha", "Explanation of alpha concept."));
        result.setKeyConcepts(concepts);

        List<DefinitionDto> defs = new ArrayList<>();
        defs.add(new DefinitionDto("Mock Term", "Formal definition of mock term."));
        result.setDefinitions(defs);

        List<ExampleDto> examples = new ArrayList<>();
        examples.add(new ExampleDto("Mock Case", "Practical real-world case study."));
        result.setExamples(examples);

        result.setKeyTakeaways(List.of("Mock Takeaway 1", "Mock Takeaway 2"));
        result.setTopicsCovered(List.of("Mock Topic 1", "Mock Topic 2"));

        return result;
    }

    @Override
    public AiStudyNotesResult generateStudyNotes(AiLectureContext context, String mode) {
        checkSimulatedErrors();

        AiStudyNotesResult result = new AiStudyNotesResult();
        result.setProviderName(getName());
        result.setFallback(false);
        result.setTitle(context.getLectureTitle() + " — " + mode.toUpperCase() + " Notes");

        StudySectionDto sec = new StudySectionDto();
        sec.setSectionId("sec_1");
        sec.setHeading("Mock Structured Section");
        sec.setFormula("$x^2 + y^2 = r^2$");
        sec.setExplanation("Mock section explanation with verified facts.");
        sec.setDerivationOrExample("Mock step-by-step calculation.");
        sec.setTakeaway("Mock section takeaway.");

        VisualizationDto viz = new VisualizationDto();
        viz.setId("viz_1");
        viz.setType("coordinate_graph");
        viz.setTitle("Mock Coordinate Graph");
        sec.setVisualization(viz);

        result.setSections(List.of(sec));
        result.setVisualizations(List.of(viz));
        result.setFormulas(List.of(new FormulaDto("Mock Formula", "$x^2 + y^2 = r^2$", "Circle equation")));
        result.setQuestions(List.of(new QuestionDto("Mock Question?", "Mock hint")));
        result.setMarkdown("# " + result.getTitle() + "\n\n## 1. " + sec.getHeading() + "\n\n" + sec.getExplanation());

        return result;
    }

    @Override
    public List<ChapterDto> generateChapters(AiLectureContext context) {
        checkSimulatedErrors();

        List<ChapterDto> chapters = new ArrayList<>();
        ChapterDto c1 = new ChapterDto();
        c1.setTitle("1. Mock Introduction");
        c1.setStartTime(0.0);
        c1.setEndTime(60.0);
        c1.setSummary("Mock chapter 1 summary");
        chapters.add(c1);

        ChapterDto c2 = new ChapterDto();
        c2.setTitle("2. Mock Deep Dive");
        c2.setStartTime(60.0);
        c2.setEndTime(180.0);
        c2.setSummary("Mock chapter 2 summary");
        chapters.add(c2);

        return chapters;
    }

    @Override
    public List<QuizQuestionDto> generateQuizQuestions(AiLectureContext context) {
        checkSimulatedErrors();

        List<QuizQuestionDto> questions = new ArrayList<>();
        QuizQuestionDto q1 = new QuizQuestionDto();
        q1.setId("qq_mock_1");
        q1.setQuestionText("What was the core topic of " + context.getLectureTitle() + "?");
        q1.setType("MCQ");
        q1.setOptions(List.of("Core theoretical principles", "Network installation", "Compilers", "None"));
        q1.setCorrectAnswer("Core theoretical principles");
        q1.setExplanation("The session introduced the foundational principles and theoretical invariants.");
        q1.setDifficulty("Easy");
        q1.setTopic("Foundations");
        questions.add(q1);

        QuizQuestionDto q2 = new QuizQuestionDto();
        q2.setId("qq_mock_2");
        q2.setQuestionText("The lecture required domain consistency and verifiable proofs.");
        q2.setType("TRUE_FALSE");
        q2.setOptions(List.of("True", "False"));
        q2.setCorrectAnswer("True");
        q2.setExplanation("Domain consistency is required across all multimodal lecture derivations.");
        q2.setDifficulty("Easy");
        q2.setTopic("Reliability");
        questions.add(q2);

        QuizQuestionDto q3 = new QuizQuestionDto();
        q3.setId("qq_mock_3");
        q3.setQuestionText("Describe the primary method presented during the lecture.");
        q3.setType("SHORT_ANSWER");
        q3.setOptions(List.of());
        q3.setCorrectAnswer("Primary method and architectural derivation.");
        q3.setExplanation("Consult the lecture summary and whiteboard derivations.");
        q3.setDifficulty("Medium");
        q3.setTopic("Methodology");
        questions.add(q3);

        return questions;
    }

    @Override
    public List<FlashcardDto> generateFlashcards(AiLectureContext context) {
        checkSimulatedErrors();

        List<FlashcardDto> cards = new ArrayList<>();
        FlashcardDto f1 = new FlashcardDto();
        f1.setId("fc_mock_1");
        f1.setQuestion("What is the primary subject of " + context.getLectureTitle() + "?");
        f1.setAnswer("Comprehensive foundational principles and academic derivations.");
        f1.setTopic("Foundations");
        f1.setDifficulty("Easy");
        cards.add(f1);

        FlashcardDto f2 = new FlashcardDto();
        f2.setId("fc_mock_2");
        f2.setQuestion("What fundamental rule governs this domain?");
        f2.setAnswer("Adherence to empirical lecture evidence and invariant consistency.");
        f2.setTopic("Principles");
        f2.setDifficulty("Medium");
        cards.add(f2);

        return cards;
    }

    @Override
    public AskLectureResponse answerLectureQuestion(AiLectureContext context, String question, List<RagChunkDto> relevantChunks) {
        checkSimulatedErrors();

        AskLectureResponse response = new AskLectureResponse();
        response.setQuestion(question);

        if (relevantChunks != null && !relevantChunks.isEmpty()) {
            RagChunkDto top = relevantChunks.get(0);
            String ts = formatOffset(top.getTimestamp());
            response.setAnswer("Based on the lecture discussion around [Timestamp " + ts + "], " + top.getSpeaker() + " explained: \"" + top.getText() + "\"");
            response.setRelevantTimestamp(ts);
            response.setTimestampSeconds(top.getTimestamp());

            List<RagSourceCitationDto> sources = new ArrayList<>();
            for (RagChunkDto chunk : relevantChunks) {
                sources.add(new RagSourceCitationDto(
                        chunk.getSourceType(),
                        formatOffset(chunk.getTimestamp()),
                        chunk.getTimestamp(),
                        chunk.getText().length() > 140 ? chunk.getText().substring(0, 140) : chunk.getText()
                ));
            }
            response.setSources(sources);
        } else {
            response.setAnswer("This topic was not covered in this lecture. Based on the transcript, this lecture focused on " + context.getLectureTitle() + ".");
            response.setRelevantTimestamp(null);
            response.setTimestampSeconds(null);
            response.setSources(List.of());
        }

        return response;
    }

    private String formatOffset(Double seconds) {
        if (seconds == null || seconds < 0) return "0:00";
        int total = seconds.intValue();
        return String.format("%d:%02d", total / 60, total % 60);
    }
}
