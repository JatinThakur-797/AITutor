package com.path.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.path.dto.LessonResourceDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LessonResourceService {

    private final YouTubeResourceService youTubeResourceService;
    private final ObjectMapper objectMapper;

    public List<LessonResourceDto> buildFiveLessonResources(
            String goalTitle,
            String lessonTitle,
            List<LessonResourceDto> aiSuggestedDocs
    ) {
        String safeGoal = goalTitle == null ? "" : goalTitle.trim();
        String safeLesson = lessonTitle == null ? "Core Concepts" : lessonTitle.trim();
        String topicQuery = (safeGoal.isEmpty() ? safeLesson : safeGoal + " " + safeLesson).trim();

        // 1. Collect up to 3 Videos (Real YouTube API watch URLs first, fallback to YouTube search links)
        List<LessonResourceDto> videos = new ArrayList<>(
                youTubeResourceService.getTop3Videos(safeGoal, safeLesson).stream().limit(3).toList()
        );

        String[] fallbackVideoQueries = {
                topicQuery + " tutorial",
                topicQuery + " explained for beginners",
                topicQuery + " practical examples"
        };
        String[] fallbackVideoTitles = {
                "Watch: " + safeLesson + " — Complete Tutorial",
                "Watch: " + safeLesson + " — Step-by-Step Guide",
                "Watch: " + safeLesson + " — Practical Examples"
        };

        int vidIdx = 0;
        while (videos.size() < 3 && vidIdx < fallbackVideoQueries.length) {
            videos.add(LessonResourceDto.builder()
                    .type("VIDEO")
                    .title(fallbackVideoTitles[vidIdx])
                    .url("https://www.youtube.com/results?search_query=" + encode(fallbackVideoQueries[vidIdx]))
                    .build());
            vidIdx++;
        }

        // 2. Collect up to 2 Docs (Clean https:// doc URLs first, fallback to search links)
        List<LessonResourceDto> docs = new ArrayList<>();
        if (aiSuggestedDocs != null) {
            docs.addAll(aiSuggestedDocs.stream()
                    .filter(doc -> {
                        if (doc == null || doc.getUrl() == null || doc.getTitle() == null || doc.getTitle().isBlank()) {
                            return false;
                        }
                        String cleanUrl = cleanMarkdownUrl(doc.getUrl());
                        return cleanUrl.startsWith("https://")
                                && !cleanUrl.contains("/results?search_query")
                                && !cleanUrl.contains("google.com/search")
                                && !cleanUrl.contains("youtube.com")
                                && !cleanUrl.contains("youtu.be");
                    })
                    .limit(2)
                    .map(doc -> LessonResourceDto.builder()
                            .type("DOC")
                            .title(doc.getTitle().trim())
                            .url(cleanMarkdownUrl(doc.getUrl()))
                            .build())
                    .toList());
        }

        String[] fallbackDocQueries = {
                topicQuery + " official documentation guide",
                topicQuery + " best practices reference"
        };
        String[] fallbackDocTitles = {
                "Read: " + safeLesson + " — Reference Guide",
                "Read: " + safeLesson + " — Concepts & Best Practices"
        };

        int docIdx = 0;
        while (docs.size() < 2 && docIdx < fallbackDocQueries.length) {
            docs.add(LessonResourceDto.builder()
                    .type("DOC")
                    .title(fallbackDocTitles[docIdx])
                    .url("https://www.google.com/search?q=" + encode(fallbackDocQueries[docIdx]))
                    .build());
            docIdx++;
        }

        List<LessonResourceDto> combined = new ArrayList<>(5);
        combined.addAll(videos.subList(0, 3));
        combined.addAll(docs.subList(0, 2));
        return combined;
    }

    /**
     * Directly populates taskContent.resources (3 videos + 2 docs) on a parsed TaskDTO map.
     */
    public void attachFiveResourcesToTaskContent(
            Map<String, Object> taskContent,
            String goalTitle,
            String lessonTitle
    ) {
        if (taskContent == null) return;

        List<LessonResourceDto> existingDocs = new ArrayList<>();
        Object rawResources = taskContent.get("resources");
        if (rawResources != null) {
            try {
                existingDocs = objectMapper.convertValue(
                        rawResources,
                        new TypeReference<List<LessonResourceDto>>() {}
                );
            } catch (Exception ignored) {
            }
        }

        List<LessonResourceDto> fiveLinks = buildFiveLessonResources(goalTitle, lessonTitle, existingDocs);
        taskContent.put("resources", fiveLinks);
    }

    public String enrichTaskJsonWithFiveLinks(String rawTaskJson, String goalTitle, String lessonTitle) {
        if (rawTaskJson == null || rawTaskJson.isBlank()) {
            return rawTaskJson;
        }
        try {
            JsonNode root = objectMapper.readTree(rawTaskJson);
            if (!(root instanceof ObjectNode rootObj)) {
                return rawTaskJson;
            }

            JsonNode contentNode = rootObj.get("content");
            if (!(contentNode instanceof ObjectNode contentObj)) {
                return rawTaskJson;
            }

            List<LessonResourceDto> aiDocs = new ArrayList<>();
            JsonNode resourcesNode = contentObj.get("resources");
            if (resourcesNode != null && resourcesNode.isArray()) {
                aiDocs = objectMapper.convertValue(
                        resourcesNode,
                        new TypeReference<List<LessonResourceDto>>() {}
                );
            }

            List<LessonResourceDto> fiveLinks = buildFiveLessonResources(goalTitle, lessonTitle, aiDocs);
            contentObj.set("resources", objectMapper.valueToTree(fiveLinks));

            return objectMapper.writeValueAsString(rootObj);
        } catch (Exception ex) {
            log.warn("Could not enrich task JSON with 5 resources: {}", ex.getMessage());
            return rawTaskJson;
        }
    }

    private String cleanMarkdownUrl(String rawUrl) {
        String trimmed = rawUrl.trim();
        // Handle accidental markdown link syntax like [https://...](https://...)
        if (trimmed.startsWith("[") && trimmed.contains("](") && trimmed.endsWith(")")) {
            int start = trimmed.indexOf("](") + 2;
            return trimmed.substring(start, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}