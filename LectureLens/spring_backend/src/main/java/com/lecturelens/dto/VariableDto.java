package com.lecturelens.dto;

public class VariableDto {
    private String symbol;
    private String meaning;
    private String unit;

    public VariableDto() {}

    public VariableDto(String symbol, String meaning, String unit) {
        this.symbol = symbol;
        this.meaning = meaning;
        this.unit = unit;
    }

    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }

    public String getMeaning() { return meaning; }
    public void setMeaning(String meaning) { this.meaning = meaning; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
}
