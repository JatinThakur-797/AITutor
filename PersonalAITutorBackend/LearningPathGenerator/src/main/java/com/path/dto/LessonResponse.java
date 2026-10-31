package com.path.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LessonResponse {

    // ✅ FIX: field is now "lesson" (matches new prompt JSON structure)
    private String lesson;

    private TaskDTO task;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskDTO {
        private String type;               // QUIZ | CODING | ACTIVITY
        private Map<String, Object> content;
    }
}