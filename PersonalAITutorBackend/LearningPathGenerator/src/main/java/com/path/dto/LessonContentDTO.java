package com.path.dto;

import lombok.ToString;

import java.util.List;
import java.util.Map;

public record LessonContentDTO(
        String title,
        List<String> subTopics,
        String content,
        String taskType,
        Map<String, Object> taskData,
        boolean isFallback // Tells the frontend if this is real or dummy data
) {}