package com.lecturelens.dto;

import java.util.List;

public class StudySectionDto {
    private String sectionId;
    private String topic;
    private String domain;
    private List<String> supportingEvidenceIds;
    private String heading;
    private String formula;
    private String explanation;
    private List<VariableDto> variables;
    private String derivationOrExample;
    private VisualizationDto visualization;
    private String takeaway;
    private String sourceSnapshotPath;

    public StudySectionDto() {}

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public List<String> getSupportingEvidenceIds() { return supportingEvidenceIds; }
    public void setSupportingEvidenceIds(List<String> supportingEvidenceIds) { this.supportingEvidenceIds = supportingEvidenceIds; }

    public String getHeading() { return heading; }
    public void setHeading(String heading) { this.heading = heading; }

    public String getFormula() { return formula; }
    public void setFormula(String formula) { this.formula = formula; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public List<VariableDto> getVariables() { return variables; }
    public void setVariables(List<VariableDto> variables) { this.variables = variables; }

    public String getDerivationOrExample() { return derivationOrExample; }
    public void setDerivationOrExample(String derivationOrExample) { this.derivationOrExample = derivationOrExample; }

    public VisualizationDto getVisualization() { return visualization; }
    public void setVisualization(VisualizationDto visualization) { this.visualization = visualization; }

    public String getTakeaway() { return takeaway; }
    public void setTakeaway(String takeaway) { this.takeaway = takeaway; }

    public String getSourceSnapshotPath() { return sourceSnapshotPath; }
    public void setSourceSnapshotPath(String sourceSnapshotPath) { this.sourceSnapshotPath = sourceSnapshotPath; }
}
