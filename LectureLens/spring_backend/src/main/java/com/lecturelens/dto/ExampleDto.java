package com.lecturelens.dto;

public class ExampleDto {
    private String topic;
    private String example;

    public ExampleDto() {}

    public ExampleDto(String topic, String example) {
        this.topic = topic;
        this.example = example;
    }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
}
