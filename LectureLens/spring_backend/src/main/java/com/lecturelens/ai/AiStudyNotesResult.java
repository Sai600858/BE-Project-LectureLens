package com.lecturelens.ai;

import com.lecturelens.dto.*;

import java.util.ArrayList;
import java.util.List;

public class AiStudyNotesResult {
    private String title = "";
    private String markdown = "";
    private List<FormulaDto> formulas = new ArrayList<>();
    private List<DiagramDto> diagrams = new ArrayList<>();
    private List<QuestionDto> questions = new ArrayList<>();
    private List<StudySectionDto> sections = new ArrayList<>();
    private List<VisualizationDto> visualizations = new ArrayList<>();
    private String providerName = "default";
    private boolean isFallback = false;

    public AiStudyNotesResult() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMarkdown() { return markdown; }
    public void setMarkdown(String markdown) { this.markdown = markdown; }

    public List<FormulaDto> getFormulas() { return formulas; }
    public void setFormulas(List<FormulaDto> formulas) { this.formulas = formulas; }

    public List<DiagramDto> getDiagrams() { return diagrams; }
    public void setDiagrams(List<DiagramDto> diagrams) { this.diagrams = diagrams; }

    public List<QuestionDto> getQuestions() { return questions; }
    public void setQuestions(List<QuestionDto> questions) { this.questions = questions; }

    public List<StudySectionDto> getSections() { return sections; }
    public void setSections(List<StudySectionDto> sections) { this.sections = sections; }

    public List<VisualizationDto> getVisualizations() { return visualizations; }
    public void setVisualizations(List<VisualizationDto> visualizations) { this.visualizations = visualizations; }

    public String getProviderName() { return providerName; }
    public void setProviderName(String providerName) { this.providerName = providerName; }

    public boolean isFallback() { return isFallback; }
    public void setFallback(boolean fallback) { isFallback = fallback; }
}
