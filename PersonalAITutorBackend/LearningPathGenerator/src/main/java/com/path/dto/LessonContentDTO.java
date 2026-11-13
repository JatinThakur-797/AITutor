package com.path.dto;

import java.util.List;
import java.util.Map;

public record LessonContentDTO(
        String title,
        List<String> subTopics,
        String content,
        String taskType,
        Map<String, Object> taskData,
        boolean isFallback,
        Boolean degraded
) {
    public LessonContentDTO(String title, List<String> subTopics, String content, String taskType, Map<String, Object> taskData, boolean isFallback) {
        this(title, subTopics, content, taskType, taskData, isFallback, isFallback);
    }
}
