package com.path.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuizResponse {

    private String goal;
    private String level_assessed;
    private java.util.List<Question> quiz;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Question {
        private int id;
        private String question;
        private String difficulty;
        private Map<String, String> options;   // 🔥 KEY FIX
        private String correct_answer;
        private String concept;
    }
}