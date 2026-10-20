package com.lecturelens.ai;

import com.lecturelens.dto.DefinitionDto;
import com.lecturelens.dto.ExampleDto;
import com.lecturelens.dto.KeyConceptDto;

import java.util.ArrayList;
import java.util.List;

public class AiSummaryResult {
    private String shortSummary = "";
    private String detailedSummary = "";
    private List<KeyConceptDto> keyConcepts = new ArrayList<>();
    private List<DefinitionDto> definitions = new ArrayList<>();
    private List<ExampleDto> examples = new ArrayList<>();
    private List<String> keyTakeaways = new ArrayList<>();
    private List<String> topicsCovered = new ArrayList<>();
    private String providerName = "default";
    private boolean isFallback = false;

    public AiSummaryResult() {}

    public String getShortSummary() { return shortSummary; }
    public void setShortSummary(String shortSummary) { this.shortSummary = shortSummary; }

    public String getDetailedSummary() { return detailedSummary; }
    public void setDetailedSummary(String detailedSummary) { this.detailedSummary = detailedSummary; }

    public List<KeyConceptDto> getKeyConcepts() { return keyConcepts; }
    public void setKeyConcepts(List<KeyConceptDto> keyConcepts) { this.keyConcepts = keyConcepts; }

    public List<DefinitionDto> getDefinitions() { return definitions; }
    public void setDefinitions(List<DefinitionDto> definitions) { this.definitions = definitions; }

    public List<ExampleDto> getExamples() { return examples; }
    public void setExamples(List<ExampleDto> examples) { this.examples = examples; }

    public List<String> getKeyTakeaways() { return keyTakeaways; }
    public void setKeyTakeaways(List<String> keyTakeaways) { this.keyTakeaways = keyTakeaways; }

    public List<String> getTopicsCovered() { return topicsCovered; }
    public void setTopicsCovered(List<String> topicsCovered) { this.topicsCovered = topicsCovered; }

    public String getProviderName() { return providerName; }
    public void setProviderName(String providerName) { this.providerName = providerName; }

    public boolean isFallback() { return isFallback; }
    public void setFallback(boolean fallback) { isFallback = fallback; }
}
