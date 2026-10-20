package com.lecturelens.dto;

public class FormulaDto {
    private String name;
    private String latex;
    private String description;

    public FormulaDto() {}

    public FormulaDto(String name, String latex, String description) {
        this.name = name;
        this.latex = latex;
        this.description = description;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getLatex() { return latex; }
    public void setLatex(String latex) { this.latex = latex; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getExpression() { return latex != null ? latex : ""; }
}
