package com.path.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.path.dto.LearningPathRequest;
import com.path.entity.LearningPath;
import com.path.repository.LearningPathRepo;
import com.path.service.AIClient;
import com.path.service.AIClientFallbackFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/path")
@RequiredArgsConstructor
public class PathController {
    private final AIClient aiClient;
    private final LearningPathRepo repo;

    private final ObjectMapper mapper;
    @PostMapping("/generate")
    public ResponseEntity<JsonNode> generate(
            @RequestBody LearningPathRequest request,
            @RequestHeader("X-User-Id") String userIdString) {

        UUID userId = UUID.fromString(userIdString);

        String prompt = buildPrompt(request);

        String aiResponse = aiClient.generateJson(prompt);

        if (AIClientFallbackFactory.SENTINEL_FALLBACK.equals(aiResponse)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI service is unavailable"
            );
        }

        JsonNode root;

        try {
            root = mapper.readTree(aiResponse);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI returned invalid JSON"
            );
        }

        // Validate the expected response structure.
        if (!root.isObject()
                || !root.path("title").isTextual()
                || !root.path("overview").isTextual()
                || !root.path("weeks").isArray()
                || root.path("weeks").isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI response does not match the learning path structure"
            );
        }

        for (JsonNode week : root.path("weeks")) {
            if (!week.path("weekNumber").canConvertToInt()
                    || !week.path("topic").isTextual()
                    || !week.path("description").isTextual()
                    || !week.path("resources").isArray()) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "AI returned an invalid weekly learning plan"
                );
            }
        }

        try {
            LearningPath path = new LearningPath();
            path.setUserId(userId);
            path.setCurrentSkills(request.getCurrentSkills());
            path.setCareerGoal(request.getCareerGoal());
            path.setLearningStyle(request.getLearningStyle());
            path.setDifficultyLevel(request.getDifficultyLevel());
            path.setPreferredDuration(request.getPreferredDuration());

            path.setContent(mapper.writeValueAsString(root));

            repo.save(path);

        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Unable to serialize learning path",
                    exception
            );
        }

        return ResponseEntity.ok(root);
    }
//    @GetMapping("/all")
//    public ResponseEntity<List<LearningPath>> getAllPaths() {
//        return ResponseEntity.ok(repo.findAllByOrderByCreatedAtDesc());
//    }

    private String buildPrompt(LearningPathRequest request) {
        return """
           Act as a professional career mentor and tech expert.
           Create a detailed learning path for a student with these details:
           
           - Current Skills: %s
           - Career Goal: %s
           - Proficiency Level: %s
           - Learning Style: %s
           - Duration: %s
           
           STRICT INSTRUCTION:
           You MUST return the response in raw JSON format. 
           Do not use Markdown code blocks (like ```json). Just the raw JSON.
           
           The JSON structure must be exactly this:
           {
             "title": "Course Title",
             "overview": "Brief summary",
             "weeks": [
               {
                 "weekNumber": 1,
                 "topic": "Topic Name",
                 "description": "What to learn",
                 "resources": ["Link 1", "Link 2"]
               }
             ]
           }
           """.formatted(
                request.getCurrentSkills(),
                request.getCareerGoal(),
                request.getDifficultyLevel(),
                request.getLearningStyle(),
                request.getPreferredDuration()
        );
    }


}
