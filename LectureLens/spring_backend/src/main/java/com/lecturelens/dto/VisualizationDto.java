package com.lecturelens.dto;

import java.util.Map;

public class VisualizationDto {
    private String id;
    private Boolean required = true;
    private String sectionHeading;
    private String type;
    private String title;
    private String caption;
    private String connectionToFormula;
    private String imagePath;
    private String sourceSnapshotPath;
    private String groundingWarning;
    private String omittedReason;
    private Map<String, Object> spec;
    private String svg;

    public VisualizationDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Boolean getRequired() { return required; }
    public void setRequired(Boolean required) { this.required = required; }

    public String getSectionHeading() { return sectionHeading; }
    public void setSectionHeading(String sectionHeading) { this.sectionHeading = sectionHeading; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }

    public String getConnectionToFormula() { return connectionToFormula; }
    public void setConnectionToFormula(String connectionToFormula) { this.connectionToFormula = connectionToFormula; }

    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }

    public String getSourceSnapshotPath() { return sourceSnapshotPath; }
    public void setSourceSnapshotPath(String sourceSnapshotPath) { this.sourceSnapshotPath = sourceSnapshotPath; }

    public String getGroundingWarning() { return groundingWarning; }
    public void setGroundingWarning(String groundingWarning) { this.groundingWarning = groundingWarning; }

    public String getOmittedReason() { return omittedReason; }
    public void setOmittedReason(String omittedReason) { this.omittedReason = omittedReason; }

    public Map<String, Object> getSpec() { return spec; }
    public void setSpec(Map<String, Object> spec) { this.spec = spec; }

    public String getSvg() { return svg; }
    public void setSvg(String svg) { this.svg = svg; }
}
