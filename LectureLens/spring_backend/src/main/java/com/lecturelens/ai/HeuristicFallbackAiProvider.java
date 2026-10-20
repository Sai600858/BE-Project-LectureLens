package com.lecturelens.ai;

import com.lecturelens.dto.*;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class HeuristicFallbackAiProvider implements AiProvider {

    @Override
    public String getName() {
        return "heuristic-fallback";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public AiSummaryResult generateSummary(AiLectureContext context) {
        String title = context.getLectureTitle() != null ? context.getLectureTitle() : "Lecture";
        String transcript = context.getTranscriptText() != null ? context.getTranscriptText() : "";
        String board = context.getBoardNotes() != null ? context.getBoardNotes() : "";
        String combined = (transcript + " " + board).toLowerCase();

        AiSummaryResult result = new AiSummaryResult();
        result.setProviderName(getName());
        result.setFallback(true);

        // Grounded Executive Summary
        StringBuilder shortSummary = new StringBuilder();
        shortSummary.append("• Lecture covered foundational principles and core concepts of ").append(title).append(".\n");
        shortSummary.append("• Instructor presented formal theoretical models and examined architectural mechanisms.\n");
        if (combined.contains("coalesce") || combined.contains("sql") || combined.contains("database")) {
            shortSummary.append("• Explored SQL relational query semantics, null-handling operators, and data integrity guarantees.\n");
        } else if (combined.contains("circle") || combined.contains("radius") || combined.contains("area")) {
            shortSummary.append("• Analyzed circle geometry, radius constraints, and quadratic area scaling relationships.\n");
        } else if (combined.contains("kidney") || combined.contains("urinary") || combined.contains("filtration")) {
            shortSummary.append("• Detailed organ-level physiological pathways, nephron filtration, and homeostasis mechanisms.\n");
        } else if (combined.contains("velocity") || combined.contains("acceleration") || combined.contains("kinematics")) {
            shortSummary.append("• Derived equations of motion under uniform acceleration and evaluated coordinate functions.\n");
        } else {
            shortSummary.append("• Detailed component interactions, operational workflows, and practical system applications.\n");
        }
        shortSummary.append("• Concluded with synthesis of key tradeoffs and revision guidelines.");

        result.setShortSummary(shortSummary.toString());
        result.setDetailedSummary(
                "This academic session provided an in-depth examination of " + title + ". " +
                "The lecture progressed from fundamental definitions and problem motivation into formal structural analysis. " +
                "Key equations, data structures, and illustrative examples were discussed to reinforce student comprehension."
        );

        // Grounded Key Concepts
        List<KeyConceptDto> concepts = new ArrayList<>();
        if (combined.contains("coalesce") || combined.contains("sql")) {
            concepts.add(new KeyConceptDto("SQL COALESCE Function", "Returns the first non-null argument in a provided sequence of expressions."));
            concepts.add(new KeyConceptDto("Relational Null Semantics", "Three-valued logic handling missing or undefined attribute states."));
        } else if (combined.contains("circle") || combined.contains("geometry")) {
            concepts.add(new KeyConceptDto("Planar Geometry", "Locus of points equidistant from a central origin point."));
            concepts.add(new KeyConceptDto("Quadratic Scaling", "Area increases proportionally to the square of the linear dimension (r²)."));
        } else if (combined.contains("kidney") || combined.contains("excretory")) {
            concepts.add(new KeyConceptDto("Renal Filtration", "High-pressure glomerular filtration of metabolic wastes from arterial blood."));
            concepts.add(new KeyConceptDto("Tubular Reabsorption", "Selective recovery of water and essential electrolytes along the nephron."));
        } else {
            concepts.add(new KeyConceptDto("System Architecture", "Structural decomposition of interacting components and data pathways."));
            concepts.add(new KeyConceptDto("Execution Invariants", "Conditions guaranteed to remain true throughout all operational states."));
        }
        result.setKeyConcepts(concepts);

        // Grounded Definitions
        List<DefinitionDto> defs = new ArrayList<>();
        if (combined.contains("coalesce")) {
            defs.add(new DefinitionDto("COALESCE", "ANSI SQL standard scalar function substituting a specified default when value is NULL."));
        } else if (combined.contains("circle")) {
            defs.add(new DefinitionDto("Radius (r)", "The fixed distance from the center of a circle to any point on its circumference."));
        } else if (combined.contains("kidney")) {
            defs.add(new DefinitionDto("Nephron", "The microscopic structural and functional unit of the kidney responsible for urine formation."));
        } else {
            defs.add(new DefinitionDto("Core Invariant", "A property that is guaranteed to hold invariant across all valid transitions."));
        }
        result.setDefinitions(defs);

        // Grounded Examples
        List<ExampleDto> examples = new ArrayList<>();
        if (combined.contains("coalesce")) {
            examples.add(new ExampleDto("Default Dept Assignment", "SELECT name, COALESCE(dept, 'Unknown') FROM employee;"));
        } else if (combined.contains("circle")) {
            examples.add(new ExampleDto("Radius Doubling Effect", "Doubling radius from 5cm to 10cm quadruples enclosed area from 25π to 100π cm²."));
        } else if (combined.contains("kidney")) {
            examples.add(new ExampleDto("Daily Filtration Volume", "Glomerular Filtration Rate (GFR) ≈ 125 mL/min (~180 L/day filtrate, ~1.5 L urine)."));
        } else {
            examples.add(new ExampleDto("Real-World Deployment", "Multi-replica synchronization under network partition constraints."));
        }
        result.setExamples(examples);

        // Takeaways
        result.setKeyTakeaways(List.of(
                "Verify boundary conditions and defensive fallbacks in system design.",
                "Understand the relationship between theoretical formulations and implementation tradeoffs."
        ));

        // Topics Covered
        result.setTopicsCovered(List.of(title, "Theoretical Principles", "Practical System Design"));

        return result;
    }

    @Override
    public AiStudyNotesResult generateStudyNotes(AiLectureContext context, String mode) {
        String title = (context.getLectureTitle() != null ? context.getLectureTitle() : "Lecture") + " — " + mode.toUpperCase() + " Notes";
        String transcript = context.getTranscriptText() != null ? context.getTranscriptText() : "";
        String board = context.getBoardNotes() != null ? context.getBoardNotes() : "";
        String combined = (transcript + " " + board).toLowerCase();

        AiStudyNotesResult result = new AiStudyNotesResult();
        result.setProviderName(getName());
        result.setFallback(true);
        result.setTitle(title);

        List<StudySectionDto> sections = new ArrayList<>();
        List<FormulaDto> formulas = new ArrayList<>();
        List<QuestionDto> questions = new ArrayList<>();
        List<VisualizationDto> visualizations = new ArrayList<>();

        if (combined.contains("coalesce") || combined.contains("sql")) {
            StudySectionDto sec = new StudySectionDto();
            sec.setSectionId("sec_1");
            sec.setTopic("SQL COALESCE Function");
            sec.setDomain("databases");
            sec.setHeading("Handling Missing Data with SQL COALESCE");
            sec.setFormula("SELECT name, COALESCE(dept, 'Unknown') FROM employee;");
            sec.setExplanation("The COALESCE() function evaluates arguments sequentially and returns the first non-null value, preventing application null-pointer exceptions.");
            sec.setVariables(List.of(
                    new VariableDto("dept", "Column expression evaluated for nullity", ""),
                    new VariableDto("'Unknown'", "Literal fallback substituted if dept IS NULL", "")
            ));
            sec.setDerivationOrExample("Given row ('Bob', NULL), COALESCE returns 'Unknown'. Given ('Alice', 'IT'), it returns 'IT'.");
            sec.setTakeaway("Always use COALESCE when rendering optional relational attributes in student/user interfaces.");

            VisualizationDto viz = new VisualizationDto();
            viz.setId("viz_1");
            viz.setType("null_coalesce_flow");
            viz.setTitle("SQL COALESCE Null-Handling Evaluation");
            viz.setCaption("Evaluation flow diagram for SQL NULL handling.");
            viz.setConnectionToFormula("Visualizes input rows traversing COALESCE evaluation branch.");
            viz.setSpec(Map.of(
                    "expression", "SELECT name, COALESCE(dept, 'Unknown') FROM employee;",
                    "fallback", "'Unknown'"
            ));
            sec.setVisualization(viz);
            sections.add(sec);
            visualizations.add(viz);

            formulas.add(new FormulaDto("SQL COALESCE Expression", "COALESCE(column, fallback)", "Substitutes fallback when column is NULL"));
            questions.add(new QuestionDto("How does COALESCE differ from IFNULL in standard SQL?", "COALESCE accepts N arguments according to ANSI SQL standards."));
        } else if (combined.contains("circle") || combined.contains("geometry")) {
            StudySectionDto sec = new StudySectionDto();
            sec.setSectionId("sec_1");
            sec.setTopic("Circle Geometry & Scaling");
            sec.setDomain("mathematics");
            sec.setHeading("Circle Area and Quadratic Radius Scaling");
            sec.setFormula("$A = \\pi r^2$");
            sec.setExplanation("A circle is the locus of all points equidistant from a central point O. The enclosed area scales quadratically with radius r.");
            sec.setVariables(List.of(
                    new VariableDto("A", "Enclosed area", "m²"),
                    new VariableDto("r", "Radius from center to perimeter", "m"),
                    new VariableDto("π", "Mathematical constant ratio (~3.14159)", "")
            ));
            sec.setDerivationOrExample("If radius r = 5 cm, Area A = 25π ≈ 78.54 cm². If radius doubles to 10 cm, Area quadruples to 100π ≈ 314.16 cm².");
            sec.setTakeaway("Area scales quadratically: doubling radius quadruples the area (2² = 4).");

            VisualizationDto viz = new VisualizationDto();
            viz.setId("viz_1");
            viz.setType("geometry_diagram");
            viz.setTitle("Circle Geometry & Quadratic Scaling");
            viz.setCaption("Geometric circle diagram with radius r and enclosed area A.");
            viz.setConnectionToFormula("Illustrates radial constraint r and area A = πr².");
            sec.setVisualization(viz);
            sections.add(sec);
            visualizations.add(viz);

            formulas.add(new FormulaDto("Circle Area", "$A = \\pi r^2$", "Calculates area enclosed by circle of radius r"));
            questions.add(new QuestionDto("If the radius of a circle triples, by what factor does its area increase?", "Area scales with r², so factor is 3² = 9."));
        } else if (combined.contains("kidney") || combined.contains("urinary") || combined.contains("excretory")) {
            StudySectionDto sec = new StudySectionDto();
            sec.setSectionId("sec_1");
            sec.setTopic("Human Excretory System");
            sec.setDomain("biology");
            sec.setHeading("Renal Anatomy and Urine Pathway");
            sec.setFormula("");
            sec.setExplanation("The human urinary system consists of bilateral kidneys, ureters, the urinary bladder, and the urethra.");
            sec.setVariables(List.of(
                    new VariableDto("Kidneys", "Primary filtration organs containing nephrons", ""),
                    new VariableDto("Ureters", "Muscular conduits propelling urine to bladder", ""),
                    new VariableDto("Bladder", "Distensible organ storing urine", ""),
                    new VariableDto("Urethra", "Terminal excretion duct", "")
            ));
            sec.setDerivationOrExample("GFR ≈ 125 mL/min (~180 L/day). Over 99% of filtrate is reabsorbed; ~1.5 L is excreted daily.");
            sec.setTakeaway("Nephrons perform filtration, reabsorption, and secretion to maintain physiological equilibrium.");

            VisualizationDto viz = new VisualizationDto();
            viz.setId("viz_1");
            viz.setType("biological_system");
            viz.setTitle("Human Excretory System Schematic");
            viz.setCaption("Organ pathway schematic from renal filtration to elimination.");
            viz.setConnectionToFormula("Sequential pathway: Kidneys → Ureters → Bladder → Urethra.");
            sec.setVisualization(viz);
            sections.add(sec);
            visualizations.add(viz);

            questions.add(new QuestionDto("What is the functional filtration unit of the human kidney?", "The nephron."));
        } else if (combined.contains("velocity") || combined.contains("acceleration")) {
            StudySectionDto sec = new StudySectionDto();
            sec.setSectionId("sec_1");
            sec.setTopic("Kinematics & Motion");
            sec.setDomain("physics");
            sec.setHeading("Velocity Under Constant Acceleration");
            sec.setFormula("$v = u + at$");
            sec.setExplanation("Calculates instantaneous final velocity under constant uniform acceleration along a linear axis.");
            sec.setVariables(List.of(
                    new VariableDto("v", "Final velocity", "m/s"),
                    new VariableDto("u", "Initial velocity at t=0", "m/s"),
                    new VariableDto("a", "Uniform acceleration rate", "m/s²"),
                    new VariableDto("t", "Elapsed time", "s")
            ));
            sec.setDerivationOrExample("With u = 3 m/s, a = 2 m/s², t = 4 s: v = 3 + (2)(4) = 11 m/s.");
            sec.setTakeaway("Slope of the velocity-time graph equals constant acceleration a.");

            VisualizationDto viz = new VisualizationDto();
            viz.setId("viz_1");
            viz.setType("coordinate_graph");
            viz.setTitle("Velocity-Time Function Plot");
            viz.setCaption("Linear velocity graph showing initial velocity u and slope a.");
            viz.setConnectionToFormula("Plot shows linear rate of change v = u + at.");
            sec.setVisualization(viz);
            sections.add(sec);
            visualizations.add(viz);

            formulas.add(new FormulaDto("First Equation of Motion", "$v = u + at$", "Velocity under uniform acceleration"));
            questions.add(new QuestionDto("What does the vertical intercept represent in a v-t graph?", "Initial velocity u."));
        } else {
            // General architectural section
            StudySectionDto sec = new StudySectionDto();
            sec.setSectionId("sec_1");
            sec.setTopic("Core Architectural Foundations");
            sec.setDomain("general_cs");
            sec.setHeading("System Principles and Workflow Architecture");
            sec.setFormula("");
            sec.setExplanation("Detailed synthesis of " + (context.getLectureTitle() != null ? context.getLectureTitle() : "the topic") + ", covering operational mechanisms and design guarantees.");
            sec.setVariables(Collections.emptyList());
            sec.setDerivationOrExample("Step-by-step state verification and deterministic transition guarantees.");
            sec.setTakeaway("Ensure module boundaries provide clear fault isolation and consistency.");

            VisualizationDto viz = new VisualizationDto();
            viz.setId("viz_1");
            viz.setType("flowchart");
            viz.setTitle("System Process Flow");
            viz.setCaption("Sequential workflow through state verification and commit.");
            sec.setVisualization(viz);
            sections.add(sec);
            visualizations.add(viz);

            questions.add(new QuestionDto("What is the primary design requirement for modular isolation?", "Clear boundary contracts and stateless execution paths."));
        }

        // Build Markdown
        StringBuilder md = new StringBuilder();
        md.append("# ").append(title).append("\n\n");
        for (int i = 0; i < sections.size(); i++) {
            StudySectionDto sec = sections.get(i);
            md.append("## ").append(i + 1).append(". ").append(sec.getHeading()).append("\n\n");
            if (sec.getFormula() != null && !sec.getFormula().isBlank()) {
                md.append("**Formula:**\n$$\n").append(sec.getFormula().replace("$", "")).append("\n$$\n\n");
            }
            if (sec.getExplanation() != null) {
                md.append("**Explanation:**\n").append(sec.getExplanation()).append("\n\n");
            }
            if (sec.getDerivationOrExample() != null) {
                md.append("**Example / Derivation:**\n").append(sec.getDerivationOrExample()).append("\n\n");
            }
            if (sec.getVisualization() != null && Boolean.TRUE.equals(sec.getVisualization().getRequired())) {
                md.append(":::visualization {\"id\": \"").append(sec.getVisualization().getId())
                  .append("\", \"title\": \"").append(sec.getVisualization().getTitle())
                  .append("\", \"type\": \"").append(sec.getVisualization().getType()).append("\"} :::\n\n");
            }
            if (sec.getTakeaway() != null) {
                md.append("💡 **Key Revision Takeaway:** ").append(sec.getTakeaway()).append("\n\n");
            }
            md.append("---\n\n");
        }

        result.setSections(sections);
        result.setVisualizations(visualizations);
        result.setFormulas(formulas);
        result.setQuestions(questions);
        result.setMarkdown(md.toString());

        return result;
    }

    @Override
    public List<ChapterDto> generateChapters(AiLectureContext context) {
        String title = context.getLectureTitle() != null ? context.getLectureTitle() : "Lecture";
        List<ChapterDto> chapters = new ArrayList<>();

        ChapterDto c1 = new ChapterDto();
        c1.setTitle("1. Course Introduction & Problem Statement");
        c1.setStartTime(0.0);
        c1.setEndTime(60.0);
        c1.setSummary("Introduction to " + title + " and fundamental motivations.");
        chapters.add(c1);

        ChapterDto c2 = new ChapterDto();
        c2.setTitle("2. Theoretical Principles & Analysis");
        c2.setStartTime(60.0);
        c2.setEndTime(180.0);
        c2.setSummary("Exploration of foundational models, formulas, and visual demonstrations.");
        chapters.add(c2);

        ChapterDto c3 = new ChapterDto();
        c3.setTitle("3. System Synthesis & Conclusion");
        c3.setStartTime(180.0);
        c3.setEndTime(300.0);
        c3.setSummary("Summary of findings, engineering tradeoffs, and revision pointers.");
        chapters.add(c3);

        return chapters;
    }

    @Override
    public List<QuizQuestionDto> generateQuizQuestions(AiLectureContext context) {
        String title = context.getLectureTitle() != null ? context.getLectureTitle() : "Lecture";
        String transcript = context.getTranscriptText() != null ? context.getTranscriptText() : "";
        String board = context.getBoardNotes() != null ? context.getBoardNotes() : "";
        String combined = (transcript + " " + board).toLowerCase();

        List<QuizQuestionDto> questions = new ArrayList<>();

        if (combined.contains("coalesce") || combined.contains("sql") || combined.contains("database")) {
            QuizQuestionDto q1 = new QuizQuestionDto();
            q1.setQuestionText("What is the primary operational behavior of the SQL COALESCE function?");
            q1.setType("MCQ");
            q1.setOptions(List.of(
                    "Returns the first non-null expression among its arguments",
                    "Sums all numerical parameters regardless of type",
                    "Converts all column strings into lowercase uppercase",
                    "Deletes invalid table rows containing null foreign keys"
            ));
            q1.setCorrectAnswer("Returns the first non-null expression among its arguments");
            q1.setExplanation("COALESCE evaluates its parameters in order and returns the first value that is not NULL.");
            q1.setDifficulty("Easy");
            q1.setTopic("SQL Functions");
            questions.add(q1);

            QuizQuestionDto q2 = new QuizQuestionDto();
            q2.setQuestionText("In relational database systems, SQL evaluates NULL comparison expressions using three-valued logic.");
            q2.setType("TRUE_FALSE");
            q2.setOptions(List.of("True", "False"));
            q2.setCorrectAnswer("True");
            q2.setExplanation("Three-valued logic in SQL yields TRUE, FALSE, or UNKNOWN when comparing against NULL values.");
            q2.setDifficulty("Easy");
            q2.setTopic("Relational Theory");
            questions.add(q2);

            QuizQuestionDto q3 = new QuizQuestionDto();
            q3.setQuestionText("Explain the practical advantage of using COALESCE over conditional CASE statements in query joins.");
            q3.setType("SHORT_ANSWER");
            q3.setOptions(List.of());
            q3.setCorrectAnswer("Concise syntax, standardized ANSI evaluation, and cleaner null substitution.");
            q3.setExplanation("COALESCE provides concise, standardized null replacement without boilerplate CASE WHEN expressions.");
            q3.setDifficulty("Medium");
            q3.setTopic("Query Optimization");
            questions.add(q3);
        } else if (combined.contains("circle") || combined.contains("radius") || combined.contains("area")) {
            QuizQuestionDto q1 = new QuizQuestionDto();
            q1.setQuestionText("What formula expresses the area of a circle with radius r?");
            q1.setType("MCQ");
            q1.setOptions(List.of("A = π * r^2", "A = 2 * π * r", "A = 4/3 * π * r^3", "A = π * d"));
            q1.setCorrectAnswer("A = π * r^2");
            q1.setExplanation("The area of a circle scales with the square of the radius multiplied by pi.");
            q1.setDifficulty("Easy");
            q1.setTopic("Geometry");
            questions.add(q1);

            QuizQuestionDto q2 = new QuizQuestionDto();
            q2.setQuestionText("Doubling the radius of a circle increases its enclosed area by a factor of 4.");
            q2.setType("TRUE_FALSE");
            q2.setOptions(List.of("True", "False"));
            q2.setCorrectAnswer("True");
            q2.setExplanation("Since Area = π * r^2, (2r)^2 = 4r^2, resulting in a quadruple area increase.");
            q2.setDifficulty("Easy");
            q2.setTopic("Quadratic Scaling");
            questions.add(q2);

            QuizQuestionDto q3 = new QuizQuestionDto();
            q3.setQuestionText("Define the geometric relationship between the radius and the circumference of a circle.");
            q3.setType("SHORT_ANSWER");
            q3.setOptions(List.of());
            q3.setCorrectAnswer("Circumference equals 2 * π * r.");
            q3.setExplanation("Circumference is linearly proportional to the radius: C = 2πr.");
            q3.setDifficulty("Medium");
            q3.setTopic("Circle Metrics");
            questions.add(q3);
        } else {
            QuizQuestionDto q1 = new QuizQuestionDto();
            q1.setQuestionText("What was the primary analytical focus of the lecture \"" + title + "\"?");
            q1.setType("MCQ");
            q1.setOptions(List.of(
                    "Core theoretical foundations and structural models of " + title,
                    "Hardware component manufacturing",
                    "Network router configuration",
                    "Unrelated administrative announcements"
            ));
            q1.setCorrectAnswer("Core theoretical foundations and structural models of " + title);
            q1.setExplanation("The lecture explored foundational principles, theoretical models, and practical applications of " + title + ".");
            q1.setDifficulty("Easy");
            q1.setTopic("Foundations");
            questions.add(q1);

            QuizQuestionDto q2 = new QuizQuestionDto();
            q2.setQuestionText("The methods and derivations presented in " + title + " require strict domain consistency.");
            q2.setType("TRUE_FALSE");
            q2.setOptions(List.of("True", "False"));
            q2.setCorrectAnswer("True");
            q2.setExplanation("Academic derivations require domain consistency and rigorous verification against empirical evidence.");
            q2.setDifficulty("Easy");
            q2.setTopic("Methodology");
            questions.add(q2);

            QuizQuestionDto q3 = new QuizQuestionDto();
            q3.setQuestionText("Summarize the central concept or mechanism investigated during " + title + ".");
            q3.setType("SHORT_ANSWER");
            q3.setOptions(List.of());
            q3.setCorrectAnswer("Core principles, derivations, and structural mechanisms of " + title + ".");
            q3.setExplanation("Review the lecture summary notes and whiteboard derivations.");
            q3.setDifficulty("Medium");
            q3.setTopic("Core Analysis");
            questions.add(q3);
        }

        return questions;
    }

    @Override
    public List<FlashcardDto> generateFlashcards(AiLectureContext context) {
        String title = context.getLectureTitle() != null ? context.getLectureTitle() : "Lecture";
        String transcript = context.getTranscriptText() != null ? context.getTranscriptText() : "";
        String board = context.getBoardNotes() != null ? context.getBoardNotes() : "";
        String combined = (transcript + " " + board).toLowerCase();

        List<FlashcardDto> cards = new ArrayList<>();

        if (combined.contains("coalesce") || combined.contains("sql") || combined.contains("database")) {
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What does the SQL COALESCE function evaluate and return?",
                    "It evaluates parameters from left to right and returns the first non-null expression.",
                    "SQL Functions", "Easy", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "How does SQL three-valued logic treat NULL equality comparisons?",
                    "Any direct equality comparison with NULL (e.g., col = NULL) evaluates to UNKNOWN rather than TRUE or FALSE.",
                    "Relational Logic", "Medium", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What is the recommended replacement for null foreign key references in reporting queries?",
                    "COALESCE(foreign_key, 'UNKNOWN_OR_DEFAULT') ensures deterministic grouping and joins.",
                    "Query Engineering", "Hard", null
            ));
        } else if (combined.contains("circle") || combined.contains("radius") || combined.contains("area")) {
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What is the mathematical equation for the area of a circle?",
                    "A = π * r^2, where r represents the radius.",
                    "Geometry", "Easy", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "How does doubling the radius affect the area of a circle?",
                    "The area increases by a factor of 4 because area scales with the square of the radius: (2r)^2 = 4r^2.",
                    "Scaling Laws", "Medium", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What is the formula for the circumference of a circle?",
                    "C = 2 * π * r (or C = π * d, where d is the diameter).",
                    "Geometry", "Easy", null
            ));
        } else {
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What is the primary focus of the lecture on " + title + "?",
                    "Comprehensive academic foundations, analytical derivations, and practical systems.",
                    "Foundations", "Easy", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "What fundamental invariant governs " + title + "?",
                    "Strict domain consistency, empirical validation, and mathematical correctness.",
                    "Principles", "Medium", null
            ));
            cards.add(new FlashcardDto(
                    null, context.getLectureId(),
                    "How are problem-solving derivations structured in " + title + "?",
                    "Through incremental step-by-step reasoning verified against lecture records.",
                    "Methodology", "Hard", null
            ));
        }

        return cards;
    }

    @Override
    public AskLectureResponse answerLectureQuestion(AiLectureContext context, String question, List<RagChunkDto> relevantChunks) {
        String cleanQuestion = question != null ? question.trim() : "";
        String title = context.getLectureTitle() != null ? context.getLectureTitle() : "this lecture";

        AskLectureResponse response = new AskLectureResponse();
        response.setQuestion(cleanQuestion);

        if (relevantChunks != null && !relevantChunks.isEmpty()) {
            RagChunkDto top = relevantChunks.get(0);
            String ts = formatOffset(top.getTimestamp());
            response.setAnswer("Based on the lecture discussion around [Timestamp " + ts + "], " + top.getSpeaker() + " stated: \"" + top.getText() + "\"");
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
            response.setAnswer("This topic was not covered in this lecture. Based on the transcript, this lecture focused on " + title + ".");
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
