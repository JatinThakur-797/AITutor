package com.path.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.path.dto.FeasibilityResponse;
import com.path.dto.LessonResponse;
import com.path.dto.QuizResponse;
import com.path.dto.RoadmapResponse;
import com.path.entity.UserGoal;
import com.path.prompts.PromptsClass;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIService {

    private final AIClient aiClient;
    private final ObjectMapper mapper;
    private final PromptsClass prompts;

    @PostConstruct
    public void init() {
        mapper.configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES, true);
    }

    // ──────────────────────────────────────────────
    // QUIZ
    // ──────────────────────────────────────────────
    public QuizResponse generateQuiz(String prompt) {
        try {
            String response = aiClient.generatePath(prompt);
            log.debug("RAW QUIZ RESPONSE:\n{}", response);

            JsonNode root = parseJsonNode(response);
            JsonNode quizArray = root.get("quiz");

            // Fix: AI sometimes returns options as array ["opt1","opt2"] instead of map {A:..}
            if (quizArray != null && quizArray.isArray()) {
                for (JsonNode question : quizArray) {
                    JsonNode optionsNode = question.get("options");
                    if (optionsNode != null && optionsNode.isArray()) {
                        ObjectNode newOptions = mapper.createObjectNode();
                        char key = 'A';
                        for (JsonNode opt : optionsNode) {
                            newOptions.put(String.valueOf(key++), opt.asText());
                        }
                        ((ObjectNode) question).set("options", newOptions);
                    }
                }
            }

            return mapper.treeToValue(root, QuizResponse.class);

        } catch (Exception e) {
            throw new RuntimeException("Quiz parsing failed: " + e.getMessage(), e);
        }
    }

    // ──────────────────────────────────────────────
    // FEASIBILITY
    // ──────────────────────────────────────────────
    public FeasibilityResponse checkFeasibility(UserGoal goal) {
        try {
            String prompt = prompts.buildFeasibilityPrompt(goal);
            String response = aiClient.generatePath(prompt);
            log.debug("RAW FEASIBILITY RESPONSE:\n{}", response);

            String clean = sanitize(response);
            return mapper.readValue(clean, FeasibilityResponse.class);

        } catch (Exception e) {
            log.warn("Feasibility parsing failed, using fallback. Error: {}", e.getMessage());

            // Fallback so the pipeline doesn't break
            FeasibilityResponse fallback = new FeasibilityResponse();
            fallback.setIsFeasible(false);
            fallback.setEstimatedDaysRequired(goal.getDuration() * 30);
            fallback.setExpectedOutcome("foundation");
            fallback.setReason("AI parsing failed — conservative fallback applied");
            return fallback;
        }
    }

    // ──────────────────────────────────────────────
    // ROADMAP
    // ──────────────────────────────────────────────
    public RoadmapResponse generateRoadmap(String prompt) {
        try {
            String response = aiClient.generatePath(prompt);
            log.debug("RAW ROADMAP RESPONSE:\n{}", response);

            JsonNode root = parseJsonNode(response);
            JsonNode roadmapNode = root.get("roadmap");

            // Fix: AI sometimes returns single object instead of array
            if (roadmapNode != null && roadmapNode.isObject()) {
                ArrayNode arrayNode = mapper.createArrayNode();
                arrayNode.add(roadmapNode);
                ((ObjectNode) root).set("roadmap", arrayNode);
            }

            return mapper.treeToValue(root, RoadmapResponse.class);

        } catch (Exception e) {
            throw new RuntimeException("Roadmap parsing failed: " + e.getMessage(), e);
        }
    }
    public LessonResponse generateLesson(String prompt) {
        try {
            System.out.println("Generate Lesson method");
            String response = aiClient.generatePath(prompt);

            log.debug("RAW LESSON:\n{}", response);

            // Strip only outer markdown wrapper (```json / ```) — NOT content inside
            String cleaned = stripOuterMarkdown(response);

            LessonResponse result = mapper.readValue(cleaned, LessonResponse.class);

            // Fallback if AI forgot task
            if (result.getTask() == null) {
                LessonResponse.TaskDTO fallback = new LessonResponse.TaskDTO();
                fallback.setType("ACTIVITY");
                fallback.setContent(Map.of("instructions", "Review the lesson above and practice the concepts in your IDE."));
                result.setTask(fallback);
            }
            result.setLesson(
                    result.getLesson()
                            .replaceAll(";", "")
                            .replaceAll("\\(\\)", "")
            );

            return result;

        } catch (Exception e) {
            log.error("Lesson generation/parsing failed: {}", e.getMessage());
            // Return a safe fallback so the UI doesn't crash
            LessonResponse fallback = new LessonResponse();
            fallback.setLesson("# Content Temporarily Unavailable\n\nPlease try refreshing the page.");
            LessonResponse.TaskDTO task = new LessonResponse.TaskDTO();
            task.setType("ACTIVITY");
            task.setContent(Map.of("instructions", "Review your notes for this topic and practice in your IDE."));
            fallback.setTask(task);
            return fallback;
        }
    }

    // ──────────────────────────────────────────────
    // TASK SERIALIZATION HELPERS
    // ──────────────────────────────────────────────
    public String convertTaskMapToString(Map<String, Object> content) {
        try {
            return content == null ? "{}" : mapper.writeValueAsString(content);
        } catch (Exception e) {
            log.error("Failed to stringify task content", e);
            return "{}";
        }
    }

    public Map<String, Object> parseTaskStringToMap(String taskData) {
        try {
            if (taskData == null || taskData.isBlank()) return new HashMap<>();
            return mapper.readValue(taskData, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse task data to map", e);
            return new HashMap<>();
        }
    }

    // ──────────────────────────────────────────────
    // UTILS
    // ──────────────────────────────────────────────

    /**
     * Strips ONLY outer ```json / ``` wrappers.
     * Does NOT strip content inside — safe for lesson markdown.
     */
    private String stripOuterMarkdown(String response) {
        if (response == null) return "{}";
        String trimmed = response.trim();

        // Remove outer ```json...``` or ```...``` wrapper only
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline != -1) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.lastIndexOf("```")).trim();
            }
        }

        // Extract outermost JSON object
        int start = trimmed.indexOf("{");
        int end = trimmed.lastIndexOf("}");
        if (start != -1 && end != -1 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return "{}";
    }


    private String sanitize(String response) {
        if (response == null) return "{}";
        response = response
                .replaceAll("(?i)```json", "")
                .replaceAll("```", "")
                .trim();
        return extractJson(response);
    }

    private JsonNode parseJsonNode(String response) {
        try {
            return mapper.readTree(sanitize(response));
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON structure from AI", e);
        }
    }

    private String extractJson(String response) {
        int start = response.indexOf("{");
        int end = response.lastIndexOf("}");
        if (start != -1 && end != -1 && end > start) {
            return response.substring(start, end + 1);
        }
        return "{}";
    }

    public String askQuestion(String prompt) {
        try {
            return aiClient.generatePath(prompt);
        } catch (Exception e) {
            log.error("AI chat question failed: {}", e.getMessage());
            return "Sorry, I am having trouble connecting to the mentor service. Please try again.";
        }
    }
}