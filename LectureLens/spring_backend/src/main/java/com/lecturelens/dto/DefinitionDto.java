package com.lecturelens.dto;

public class DefinitionDto {
    private String term;
    private String definition;

    public DefinitionDto() {}

    public DefinitionDto(String term, String definition) {
        this.term = term;
        this.definition = definition;
    }

    public String getTerm() { return term; }
    public void setTerm(String term) { this.term = term; }

    public String getDefinition() { return definition; }
    public void setDefinition(String definition) { this.definition = definition; }
}
