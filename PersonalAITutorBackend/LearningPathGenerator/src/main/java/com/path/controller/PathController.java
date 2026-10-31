package com.path.controller;

import com.path.dto.LearningPathRequest;
import com.path.entity.LearningPath;
import com.path.repository.LearningPathRepo;
import com.path.service.AIClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/path")
@RequiredArgsConstructor
public class PathController {
    private final AIClient aiClient;
    private final LearningPathRepo repo;


    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody LearningPathRequest request , @RequestHeader("X-User-Id") String userIdString){
        System.out.println("From PathController Generate Method");
        UUID userId = UUID.fromString(userIdString);
        String prompt = buildPrompt(request);
        String aiResponse = aiClient.generatePath(prompt);
        LearningPath path = new LearningPath();
        path.setUserId(userId);
        path.setCurrentSkills(request.getCurrentSkills());
        path.setCareerGoal(request.getCareerGoal());
        path.setLearningStyle(request.getLearningStyle());
        path.setDifficultyLevel(request.getDifficultyLevel());
        path.setPreferredDuration(request.getPreferredDuration());
        path.setContent(aiResponse); // The JSON from AI

        repo.save(path);
        return ResponseEntity.ok(aiResponse);

    }
    @GetMapping("/all")
    public ResponseEntity<List<LearningPath>> getAllPaths() {
        return ResponseEntity.ok(repo.findAllByOrderByCreatedAtDesc());
    }

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
