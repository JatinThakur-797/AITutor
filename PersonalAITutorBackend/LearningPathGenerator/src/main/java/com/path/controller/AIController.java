package com.path.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.path.dto.*;
import com.path.entity.DayPlan;
import com.path.entity.Roadmap;
import com.path.entity.UserGoal;
import com.path.enums.GoalStatus;
import com.path.prompts.PromptsClass;
import com.path.repository.DayPlanRepo;
import com.path.repository.RoadmapRepo;
import com.path.repository.UserGoalRepo;
import com.path.service.AIService;
import com.path.service.LessonService;
import com.path.service.RoadmapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/path")
@RequiredArgsConstructor
public class AIController {

    private final AIService aiService;
    private final PromptsClass prompts;
    private final UserGoalRepo goalRepo;
    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;
    private final RoadmapService roadmapService;
    private final LessonService lessonService;


    // ─────────────────────────────────────────
    // STEP 1 → QUIZ
    // ─────────────────────────────────────────
    @PostMapping("/testSkills")
    public ResponseEntity<QuizResponse> generateQuiz(
            @Valid @RequestBody UserRequest request,
            @RequestHeader("X-User-Id") String userIdString
    ) {
        System.out.println("From Quiz controller");
        UUID userId = parseUserId(userIdString);

        // Save goal record — status = QUIZ_PENDING
        UserGoal goal = new UserGoal();
        goal.setUserId(userId);
        goal.setFromRequest(request);
        goal.setStatus(GoalStatus.QUIZ_PENDING);
        goalRepo.save(goal);

        String prompt = prompts.buildQuizPrompt(request);
        QuizResponse quiz = aiService.generateQuiz(prompt);

        return ResponseEntity.ok(quiz);
    }

    // ─────────────────────────────────────────
    // STEP 2 → FEASIBILITY
    // ─────────────────────────────────────────
    @PostMapping("/feasibility")
    public ResponseEntity<FeasibilityResponse> checkFeasibility(
            @RequestBody Report report,
            @RequestHeader("X-User-Id") String userIdString
    ) {
        UUID userId = parseUserId(userIdString);
        UserGoal goal = getLatestGoal(userId);

        // Guard: quiz must have been taken
        validateStatus(goal, GoalStatus.QUIZ_PENDING, "Quiz must be completed before feasibility check");

        // Save assigned level from quiz result
        goal.setAssignedLevel(report.getAssignedLevel());
        goalRepo.save(goal);

        // Call AI for feasibility
        FeasibilityResponse response = aiService.checkFeasibility(goal);

        // ✅ FIX: Save feasibility result to DB — used in roadmap generation
        goal.setFeasible(response.getIsFeasible());
        goal.setEstimatedDaysRequired(response.getEstimatedDaysRequired());
        goal.setExpectedOutcome(response.getExpectedOutcome());
        goal.setFeasibilityReason(response.getReason());
        goal.setStatus(GoalStatus.FEASIBILITY_DONE);
        goalRepo.save(goal);

        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────
    // STEP 3 → ROADMAP
    // ─────────────────────────────────────────
    @PostMapping("/roadmap")
    public ResponseEntity<RoadmapResponse> generateRoadmap(
            @RequestHeader("X-User-Id") String userIdString,
            @RequestParam int startDay,
            @RequestParam int days
    ) {
        UUID userId = parseUserId(userIdString);
        UserGoal goal = getLatestGoal(userId);

        // Allow both: first generation (FEASIBILITY_DONE) and subsequent chunks (ROADMAP_GENERATED)
        if (goal.getStatus() != GoalStatus.FEASIBILITY_DONE &&
                goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {
            throw new RuntimeException(
                    "Feasibility check must be completed before roadmap generation. Current status: " + goal.getStatus()
            );
        }
        // Guard: feasibility must be done first
//        validateStatus(goal, GoalStatus.FEASIBILITY_DONE, "Feasibility check must be completed before roadmap generation");

        Roadmap roadmap = getOrCreateRoadmap(goal);

        // ✅ FIX: coveredTopics from optimized query (no LazyInitializationException)
        List<String> coveredTopics = roadmapService.getCoveredTopics(roadmap);

        // ✅ FIX: feasibility data comes from saved entity — no more hardcoded values
        String prompt = prompts.buildRoadmapPromptWithMemory(goal, startDay, days, coveredTopics);

        RoadmapResponse response = aiService.generateRoadmap(prompt);
        roadmapService.saveRoadmapChunk(roadmap, response.getRoadmap());

        // Update status on first generation
        if (goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {
            goal.setStatus(GoalStatus.ROADMAP_GENERATED);
            goalRepo.save(goal);
        }

        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────
    // SIDEBAR: Get all goals for a user
    // ─────────────────────────────────────────
    @GetMapping("/goals")
    public ResponseEntity<List<GoalSummaryDTO>> getAllGoals(
            @RequestHeader("X-User-Id") String userIdString
    ) {
        UUID userId = parseUserId(userIdString);

        List<GoalSummaryDTO> summaries = goalRepo
                .findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(goal -> {
                    Integer totalDays = null;
                    Long completedDays = null;

                    if (goal.getStatus() == GoalStatus.ROADMAP_GENERATED) {
                        var roadmap = roadmapRepo.findByUserGoalId(goal.getId());
                        if (roadmap.isPresent()) {
                            totalDays = roadmap.get().getTotalDays();
                            completedDays = dayPlanRepo
                                    .countByRoadmapIdAndIsCompleted(roadmap.get().getId(), true);
                        }
                    }

                    return new GoalSummaryDTO(
                            goal.getId(),
                            goal.getGoal(),
                            goal.getCurrentLevel(),
                            goal.getAssignedLevel(),
                            goal.getDuration(),
                            goal.getStatus(),
                            goal.getFeasible(),
                            goal.getExpectedOutcome(),
                            goal.getCreatedAt(),
                            totalDays,
                            completedDays
                    );
                })
                .toList();

        return ResponseEntity.ok(summaries);
    }

    // ─────────────────────────────────────────
    // PROGRESS: Mark a day as completed
    // ─────────────────────────────────────────
    @PatchMapping("/roadmap/{goalId}/day/{dayNumber}/complete")
    public ResponseEntity<Void> markDayComplete(
            @PathVariable UUID goalId,
            @PathVariable Integer dayNumber,
            @RequestHeader("X-User-Id") String userIdString
    ) {
        UUID userId = parseUserId(userIdString);
        System.out.println("gaol Id " + goalId + " day Number : " + dayNumber);
        // Security: verify the goal belongs to this user
        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new RuntimeException("Goal not found or access denied"));

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() -> new RuntimeException("Roadmap not found for this goal"));

        roadmapService.markDayCompleted(roadmap.getId(), dayNumber);

        return ResponseEntity.ok().build();
    }
    @GetMapping("/roadmap/{goalId}/days")
    public ResponseEntity<?> getRoadmapDays(
            @PathVariable UUID goalId,
            @RequestHeader("X-User-Id") String userIdString
    ) {

        UUID userId = parseUserId(userIdString);
        System.out.println("Request reached to getRoadmapDays method");
        // Security: verify ownership
        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() -> new RuntimeException("Roadmap not found"));

        List<DayPlan> days = dayPlanRepo
                .findByRoadmapIdOrderByDayNumberAsc(roadmap.getId());

        // Map to the same structure frontend expects
        Map<String, Object> response = new HashMap<>();
        response.put("goalId", goalId);
        response.put("days", days.stream().map(d -> {
            Map<String, Object> day = new HashMap<>();
            day.put("day", d.getDayNumber());
            day.put("main_topic", d.getMainTopic());
            day.put("sub_topics", d.getSubTopics());
            day.put("daily_goal", d.getDailyGoal());
            day.put("completed", d.getIsCompleted());
            Map<String, String> hours = new HashMap<>();
            hours.put("theory", d.getTheoryHours());
            hours.put("practice", d.getPracticeHours());
            day.put("hours_allocation", hours);
            return day;
        }).toList());

        return ResponseEntity.ok(response);
    }




    @GetMapping("/roadmap/{goalId}/day/{dayNumber}/lesson")
    public ResponseEntity<LessonContentDTO> getLessonContent(
            @PathVariable UUID goalId,
            @PathVariable Integer dayNumber,
            @RequestHeader("X-User-Id") String userIdString
    ) {
        UUID userId = parseUserId(userIdString);

        LessonContentDTO response = lessonService.getOrGenerateLesson(goalId, dayNumber, userId);
        return ResponseEntity.ok(response);
    }
    // ─────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────

    private UUID parseUserId(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid user ID format");
        }
    }

    private UserGoal getLatestGoal(UUID userId) {
        return goalRepo.findFirstByUserIdOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new RuntimeException("No goal found for user. Start by calling /testSkills first."));
    }

    private void validateStatus(UserGoal goal, GoalStatus requiredStatus, String message) {
        if (goal.getStatus() != requiredStatus) {
            throw new RuntimeException(message + ". Current status: " + goal.getStatus());
        }
    }

    private Roadmap getOrCreateRoadmap(UserGoal goal) {
        return roadmapRepo.findByUserGoal(goal)
                .orElseGet(() -> {
                    Roadmap r = new Roadmap();
                    r.setUserGoal(goal);
                    r.setTotalDays(goal.getDuration() * 30);
                    r.setMode(computeMode(goal));
                    return roadmapRepo.save(r);
                });
    }

    private String computeMode(UserGoal goal) {
        boolean feasible = Boolean.TRUE.equals(goal.getFeasible());
        if (!feasible) return "FAST";
        int totalDays = goal.getDuration() * 30;
        int estimated = goal.getEstimatedDaysRequired() != null ? goal.getEstimatedDaysRequired() : totalDays;
        return totalDays <= estimated * 1.2 ? "MEDIUM" : "NATURAL";
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> askMentor(
            @RequestBody Map<String, String> body
    ) {
        String message = body.get("message");
        String lessonTitle = body.get("lessonTitle");
        String lessonContent = body.get("lessonContent");

        if (message == null || message.isBlank()) {
            throw new RuntimeException("Message cannot be empty");
        }

        String prompt = prompts.buildChatPrompt(message, lessonTitle, lessonContent);
        String aiResponse = aiService.askQuestion(prompt);

        Map<String, String> response = new HashMap<>();
        response.put("response", aiResponse);

        return ResponseEntity.ok(response);
    }
}