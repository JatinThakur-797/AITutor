
package com.path.controller;

import com.path.dto.*;
import com.path.entity.LearningPath;
import com.path.service.GoalService;
import com.path.service.LearningPathService;
import com.path.service.LessonService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/path")
@RequiredArgsConstructor
public class AIController {

    private final GoalService goalService;
    private final LessonService lessonService;
    private final LearningPathService learningPathService;


    // =========================================
    // STEP 1: GENERATE QUIZ
    // =========================================

    @PostMapping("/testSkills")
    public ResponseEntity<QuizResponse> generateQuiz(
            @Valid @RequestBody UserRequest request,
            @RequestHeader("X-User-Id") UUID userId) {

        QuizResponse response =
                goalService.generateQuiz(request, userId);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // STEP 2: CHECK FEASIBILITY
    // =========================================

    @PostMapping("/feasibility")
    public ResponseEntity<FeasibilityResponse> checkFeasibility(
            @RequestBody Report report,
            @RequestHeader("X-User-Id") UUID userId) {

        FeasibilityResponse response =
                goalService.checkFeasibility(report, userId);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // STEP 3: GENERATE ROADMAP
    // =========================================

    @PostMapping("/roadmap")
    public ResponseEntity<RoadmapResponse> generateRoadmap(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam int startDay,
            @RequestParam int days) {

        RoadmapResponse response =
                goalService.generateRoadmap(userId, startDay, days);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // GET ALL GOALS
    // =========================================

    @GetMapping("/goals")
    public ResponseEntity<List<GoalSummaryDTO>> getAllGoals(
            @RequestHeader("X-User-Id") UUID userId) {

        List<GoalSummaryDTO> response =
                goalService.getAllGoals(userId);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // MARK DAY COMPLETE
    // =========================================

    @PatchMapping("/roadmap/{goalId}/day/{dayNumber}/complete")
    public ResponseEntity<Void> markDayComplete(
            @PathVariable UUID goalId,
            @PathVariable Integer dayNumber,
            @RequestHeader("X-User-Id") UUID userId) {

        goalService.markDayComplete(
                goalId,
                dayNumber,
                userId
        );

        return ResponseEntity.ok().build();
    }


    // =========================================
    // GET ROADMAP DAYS
    // =========================================

    @GetMapping("/roadmap/{goalId}/days")
    public ResponseEntity<Map<String, Object>> getRoadmapDays(
            @PathVariable UUID goalId,
            @RequestHeader("X-User-Id") UUID userId) {

        Map<String, Object> response =
                goalService.getRoadmapDays(goalId, userId);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // GET LESSON CONTENT
    // =========================================

    @GetMapping("/roadmap/{goalId}/day/{dayNumber}/lesson")
    public ResponseEntity<LessonContentDTO> getLessonContent(
            @PathVariable UUID goalId,
            @PathVariable Integer dayNumber,
            @RequestHeader("X-User-Id") UUID userId) {

        LessonContentDTO response =
                lessonService.getOrGenerateLesson(
                        goalId,
                        dayNumber,
                        userId
                );

        return ResponseEntity.ok(response);
    }


    // =========================================
    // AI MENTOR CHAT
    // =========================================

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> askMentor(
            @RequestBody Map<String, String> body) {

        Map<String, String> response =
                goalService.askMentor(body);

        return ResponseEntity.ok(response);
    }


    // =========================================
    // LEGACY LEARNING PATH ENDPOINTS
    // =========================================

    @GetMapping("/all")
    public ResponseEntity<List<LearningPath>> getAllPaths(
            @RequestHeader("X-User-Id") UUID userId) {

        return ResponseEntity.ok(
                learningPathService.getAllPaths(userId)
        );
    }

    // =========================================
// AI MENTOR CHAT - SSE STREAMING
// =========================================

    @PostMapping(
            value = "/chat/stream",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public ResponseEntity<Flux<ServerSentEvent<String>>> streamMentor(
            @RequestBody Map<String, String> body,
            @RequestHeader("X-User-Id") UUID userId) {

        Flux<ServerSentEvent<String>> stream =
                goalService.streamMentor(body, userId)

                        .onErrorResume(error -> {

                            // Do not send internal exceptions to the browser.
                            return Flux.just(
                                    ServerSentEvent.<String>builder(
                                                    "AI mentor is temporarily unavailable. Please try again."
                                            )
                                            .event("error")
                                            .build()
                            );
                        });

        return ResponseEntity.ok()

                .contentType(MediaType.TEXT_EVENT_STREAM)

                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-cache"
                )

                // Helps avoid reverse-proxy buffering on deployments
                // that support this header.
                .header(
                        "X-Accel-Buffering",
                        "no"
                )

                .body(stream);
    }
}
