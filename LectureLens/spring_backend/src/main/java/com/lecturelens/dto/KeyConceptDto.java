package com.lecturelens.dto;

public class KeyConceptDto {
    private String concept;
    private String description;

    public KeyConceptDto() {}

    public KeyConceptDto(String concept, String description) {
        this.concept = concept;
        this.description = description;
    }

    public String getConcept() { return concept; }
    public void setConcept(String concept) { this.concept = concept; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
