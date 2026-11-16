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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AIService {
    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    public static final String DEGRADED_MESSAGE = "The tutor is briefly unavailable — showing a starter set. Retry in a few seconds.";

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

            if (isDownstreamFailure(response)) {
                return buildDegradedQuiz(null);
            }

            JsonNode root = parseJsonNode(response);
            JsonNode quizArray = root.get("quiz");

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

            QuizResponse quizResponse = mapper.treeToValue(root, QuizResponse.class);
            if (quizResponse.getQuiz() == null || quizResponse.getQuiz().isEmpty()) {
                return buildDegradedQuiz(null);
            }
            quizResponse.setDegraded(false);
            return quizResponse;

        } catch (Exception e) {
            log.warn("Quiz generation/parsing failed, returning degraded starter set: {}", e.getMessage());
            return buildDegradedQuiz(null);
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

            if (isDownstreamFailure(response)) {
                return buildDegradedFeasibility(goal);
            }

            String clean = sanitize(response);
            FeasibilityResponse feasibilityResponse = mapper.readValue(clean, FeasibilityResponse.class);
            feasibilityResponse.setDegraded(false);
            return feasibilityResponse;

        } catch (Exception e) {
            log.warn("Feasibility parsing failed, using degraded fallback. Error: {}", e.getMessage());
            return buildDegradedFeasibility(goal);
        }
    }

    // ──────────────────────────────────────────────
    // ROADMAP
    // ──────────────────────────────────────────────
    public RoadmapResponse generateRoadmap(String prompt) {
        try {
            String response = aiClient.generatePath(prompt);
            log.debug("RAW ROADMAP RESPONSE:\n{}", response);

            if (isDownstreamFailure(response)) {
                return buildDegradedRoadmap(null, 1);
            }

            JsonNode root = parseJsonNode(response);
            JsonNode roadmapNode = root.get("roadmap");

            if (roadmapNode != null && roadmapNode.isObject()) {
                ArrayNode arrayNode = mapper.createArrayNode();
                arrayNode.add(roadmapNode);
                ((ObjectNode) root).set("roadmap", arrayNode);
            }

            RoadmapResponse roadmapResponse = mapper.treeToValue(root, RoadmapResponse.class);
            if (roadmapResponse.getRoadmap() == null || roadmapResponse.getRoadmap().isEmpty()) {
                return buildDegradedRoadmap(null, 1);
            }
            roadmapResponse.setDegraded(false);
            return roadmapResponse;

        } catch (Exception e) {
            log.warn("Roadmap parsing failed, returning degraded starter set: {}", e.getMessage());
            return buildDegradedRoadmap(null, 1);
        }
    }


    public LessonResponse generateLesson(String prompt) {
        try {
            String response = aiClient.generatePath(prompt);

            if (isDownstreamFailure(response)) {
                return buildDegradedLesson();
            }

            log.info("Lesson AI response received. Characters: {}", response.length());

            String lessonMarkdown = extractSection(
                    response, "<LESSON>", "</LESSON>"
            );

            if (lessonMarkdown == null || lessonMarkdown.isBlank()) {
                throw new IllegalArgumentException(
                        "AI response does not contain a valid LESSON section"
                );
            }

            String taskJson = extractSection(
                    response, "<TASK>", "</TASK>"
            );

            LessonResponse result = new LessonResponse();
            result.setLesson(lessonMarkdown.trim());

            LessonResponse.TaskDTO task = parseLessonTask(taskJson);
            result.setTask(task);

            result.setDegraded(false);
            return result;

        } catch (Exception e) {
            log.error(
                    "Lesson generation failed. Reason: {}",
                    e.getMessage(),
                    e
            );

            return buildDegradedLesson();
        }
    }

    private String extractSection(
            String response,
            String startMarker,
            String endMarker
    ) {
        if (response == null) {
            return null;
        }

        int start = response.indexOf(startMarker);
        if (start < 0) {
            return null;
        }

        start += startMarker.length();

        int end = response.indexOf(endMarker, start);
        if (end < 0) {
            return null;
        }

        return response.substring(start, end).trim();
    }

    private LessonResponse.TaskDTO parseLessonTask(String taskJson) {
        LessonResponse.TaskDTO task = new LessonResponse.TaskDTO();

        try {
            if (taskJson == null || taskJson.isBlank()) {
                throw new IllegalArgumentException("Missing TASK section");
            }

            JsonNode root = mapper.readTree(taskJson);

            String type = root.path("type").asText("ACTIVITY");
            JsonNode contentNode = root.path("content");

            if (!contentNode.isObject()) {
                throw new IllegalArgumentException("Invalid task content");
            }

            Map<String, Object> content = mapper.convertValue(
                    contentNode,
                    mapper.getTypeFactory().constructMapType(
                            HashMap.class,
                            String.class,
                            Object.class
                    )
            );

            if (!List.of("QUIZ", "CODING", "ACTIVITY").contains(type.toUpperCase())) {
                type = "ACTIVITY";
                content = Map.of(
                        "instructions",
                        "Review the lesson and practice its concepts in your IDE."
                );
            }

            task.setType(type.toUpperCase());
            task.setContent(content);

            return task;

        } catch (Exception e) {
            log.warn("Assessment parsing failed: {}", e.getMessage());

            task.setType("ACTIVITY");
            task.setContent(Map.of(
                    "instructions",
                    "Review the lesson and practice its concepts in your IDE."
            ));

            return task;
        }
    }


    // ──────────────────────────────────────────────
    // DEGRADED BUILDERS
    // ──────────────────────────────────────────────
    private boolean isDownstreamFailure(String response) {
        return response == null || response.isBlank() || AIClientFallbackFactory.SENTINEL_FALLBACK.equals(response);
    }

    private QuizResponse buildDegradedQuiz(String goal) {
        QuizResponse fallback = new QuizResponse();
        fallback.setGoal(goal != null ? goal : "General Development");
        fallback.setLevel_assessed("Beginner");
        fallback.setDegraded(true);
        fallback.setMessage(DEGRADED_MESSAGE);

        QuizResponse.Question q1 = new QuizResponse.Question();
        q1.setId(1);
        q1.setDifficulty("easy");
        q1.setConcept("Variables & State");
        q1.setQuestion("What is a variable used for in computer programming?");
        q1.setOptions(Map.of(
                "A", "To store data values that can be referenced and manipulated",
                "B", "To directly accelerate hardware CPU clock speeds",
                "C", "To connect network routers together",
                "D", "To compile source code into machine binaries"
        ));
        q1.setCorrect_answer("A");

        QuizResponse.Question q2 = new QuizResponse.Question();
        q2.setId(2);
        q2.setDifficulty("medium");
        q2.setConcept("Data Structures");
        q2.setQuestion("Which data structure operates on a First-In, First-Out (FIFO) basis?");
        q2.setOptions(Map.of(
                "A", "Stack",
                "B", "Queue",
                "C", "Binary Heap",
                "D", "Hash Map"
        ));
        q2.setCorrect_answer("B");

        QuizResponse.Question q3 = new QuizResponse.Question();
        q3.setId(3);
        q3.setDifficulty("hard");
        q3.setConcept("Algorithmic Complexity");
        q3.setQuestion("What is the average time complexity of searching an element in a balanced binary search tree (BST)?");
        q3.setOptions(Map.of(
                "A", "O(1)",
                "B", "O(n)",
                "C", "O(log n)",
                "D", "O(n log n)"
        ));
        q3.setCorrect_answer("C");

        fallback.setQuiz(List.of(q1, q2, q3));
        return fallback;
    }

    private RoadmapResponse buildDegradedRoadmap(String goal, int startDay) {
        RoadmapResponse fallback = new RoadmapResponse();
        fallback.setGoal(goal != null ? goal : "General Development");
        fallback.setStartDay(startDay);
        fallback.setEndDay(startDay + 2);
        fallback.setDegraded(true);
        fallback.setMessage(DEGRADED_MESSAGE);

        RoadmapResponse.DayPlanDTO d1 = new RoadmapResponse.DayPlanDTO();
        d1.setDay(startDay);
        d1.setMainTopic("Core Foundations & Environment");
        d1.setSubTopics(List.of("Workspace Setup", "Syntax & Structure"));
        RoadmapResponse.Hours h1 = new RoadmapResponse.Hours();
        h1.setTheory("1 hour");
        h1.setPractice("2 hours");
        d1.setHoursAllocation(h1);
        d1.setDailyGoal("Configure developer tools and write your first foundational code.");

        RoadmapResponse.DayPlanDTO d2 = new RoadmapResponse.DayPlanDTO();
        d2.setDay(startDay + 1);
        d2.setMainTopic("Fundamental Logic & Data Control");
        d2.setSubTopics(List.of("Conditionals & Branching", "Loops & Iterations"));
        RoadmapResponse.Hours h2 = new RoadmapResponse.Hours();
        h2.setTheory("1.5 hours");
        h2.setPractice("1.5 hours");
        d2.setHoursAllocation(h2);
        d2.setDailyGoal("Master control flow logic and iterative processing.");

        RoadmapResponse.DayPlanDTO d3 = new RoadmapResponse.DayPlanDTO();
        d3.setDay(startDay + 2);
        d3.setMainTopic("Modular Programming & Practice");
        d3.setSubTopics(List.of("Functions & Methods", "Basic Error Handling"));
        RoadmapResponse.Hours h3 = new RoadmapResponse.Hours();
        h3.setTheory("1 hour");
        h3.setPractice("2 hours");
        d3.setHoursAllocation(h3);
        d3.setDailyGoal("Break code into modular units and test error scenarios.");

        fallback.setRoadmap(List.of(d1, d2, d3));
        return fallback;
    }

    private FeasibilityResponse buildDegradedFeasibility(UserGoal goal) {
        FeasibilityResponse fallback = new FeasibilityResponse();
        fallback.setIsFeasible(true);
        fallback.setEstimatedDaysRequired(goal != null ? goal.getDuration() * 30 : 90);
        fallback.setExpectedOutcome("foundation");
        fallback.setReason(DEGRADED_MESSAGE);
        fallback.setDegraded(true);
        return fallback;
    }

    private LessonResponse buildDegradedLesson() {
        LessonResponse fallback = new LessonResponse();
        fallback.setLesson("# The tutor is briefly unavailable\n\nShowing a starter set. Retry in a few seconds.\n\n## Overview\n\nTake a moment to review the topic concepts in your notes or practice in your local editor while connectivity is restored.");
        LessonResponse.TaskDTO task = new LessonResponse.TaskDTO();
        task.setType("ACTIVITY");
        task.setContent(Map.of("instructions", "Review your notes and practice in your IDE while the tutor reconnects."));
        fallback.setTask(task);
        fallback.setDegraded(true);
        fallback.setMessage(DEGRADED_MESSAGE);
        return fallback;
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
    private String stripOuterMarkdown(String response) {
        if (response == null) return "{}";
        String trimmed = response.trim();

        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline != -1) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.lastIndexOf("```")).trim();
            }
        }

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
            String res = aiClient.generatePath(prompt);
            if (isDownstreamFailure(res)) {
                return DEGRADED_MESSAGE;
            }
            return res;
        } catch (Exception e) {
            log.error("AI chat question failed: {}", e.getMessage());
            return DEGRADED_MESSAGE;
        }
    }
}
