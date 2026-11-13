package com.path.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LessonResponse {

    private String lesson;
    private TaskDTO task;
    private Boolean degraded = false;
    private String message;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskDTO {
        private String type;               // QUIZ | CODING | ACTIVITY
        private Map<String, Object> content;
    }
}
