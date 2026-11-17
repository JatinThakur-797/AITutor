
package com.path.service;

import com.path.dto.*;
import com.path.entity.DayPlan;
import com.path.entity.Roadmap;
import com.path.entity.UserGoal;
import com.path.enums.GoalStatus;
import com.path.prompts.PromptsClass;
import com.path.repository.DayPlanRepo;
import com.path.repository.RoadmapRepo;
import com.path.repository.UserGoalRepo;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GoalService {

    private static final Logger log =
            LoggerFactory.getLogger(GoalService.class);

    private final AIService aiService;
    private final PromptsClass prompts;

    private final UserGoalRepo goalRepo;
    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;
    private final AIStreamingClient aiStreamingClient;

    private final RoadmapService roadmapService;


    // =========================================
    // STEP 1: GENERATE QUIZ
    // =========================================

    public QuizResponse generateQuiz(
            UserRequest request,
            UUID userId) {

        log.debug("Generating quiz for userId={}", userId);

        UserGoal goal = new UserGoal();

        goal.setUserId(userId);
        goal.setFromRequest(request);
        goal.setStatus(GoalStatus.QUIZ_PENDING);

        goalRepo.save(goal);

        String prompt = prompts.buildQuizPrompt(request);

        return aiService.generateQuiz(prompt);
    }


    // =========================================
    // STEP 2: CHECK FEASIBILITY
    // =========================================

    public FeasibilityResponse checkFeasibility(
            Report report,
            UUID userId) {

        UserGoal goal = getLatestGoal(userId);

        validateStatus(
                goal,
                GoalStatus.QUIZ_PENDING,
                "Quiz must be completed before feasibility check"
        );

        goal.setAssignedLevel(report.getAssignedLevel());
        goalRepo.save(goal);

        FeasibilityResponse response =
                aiService.checkFeasibility(goal);

        if (response == null) {
            throw new IllegalStateException(
                    "Feasibility service returned no response"
            );
        }

        // Do not persist a fallback as a genuine AI assessment.
        if (Boolean.TRUE.equals(response.getDegraded())) {
            log.warn(
                    "Feasibility generation degraded for goal {}",
                    goal.getId()
            );

            return response;
        }

        goal.setFeasible(response.getIsFeasible());

        goal.setEstimatedDaysRequired(
                response.getEstimatedDaysRequired()
        );

        goal.setExpectedOutcome(response.getExpectedOutcome());
        goal.setFeasibilityReason(response.getReason());

        goal.setStatus(GoalStatus.FEASIBILITY_DONE);

        goalRepo.save(goal);

        return response;
    }


    // =========================================
    // STEP 3: GENERATE ROADMAP
    // =========================================

    public RoadmapResponse generateRoadmap(
            UUID userId,
            int startDay,
            int days) {

        if (startDay < 1 || days < 1) {
            throw new IllegalArgumentException(
                    "startDay and days must be positive"
            );
        }

        UserGoal goal = getLatestGoal(userId);

        if (goal.getStatus() != GoalStatus.FEASIBILITY_DONE &&
                goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {

            throw new IllegalStateException(
                    "Feasibility check must be completed before roadmap generation. " +
                            "Current status: " + goal.getStatus()
            );
        }

        // Do not create a new roadmap before successful AI generation.
        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElse(null);

        List<String> coveredTopics =
                roadmap == null
                        ? List.of()
                        : roadmapService.getCoveredTopics(roadmap);

        String prompt = prompts.buildRoadmapPromptWithMemory(
                goal,
                startDay,
                days,
                coveredTopics
        );

        RoadmapResponse response =
                aiService.generateRoadmap(prompt);

        if (response == null ||
                !Boolean.FALSE.equals(response.getDegraded())) {

            log.warn(
                    "Roadmap generation failed or degraded for goal {}",
                    goal.getId()
            );

            return response;
        }

        // Create the roadmap only after a successful AI response.
        if (roadmap == null) {
            roadmap = roadmapService.getOrCreateRoadmap(goal);
        }

        roadmapService.saveRoadmapChunk(
                roadmap,
                response.getRoadmap()
        );

        if (goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {
            goal.setStatus(GoalStatus.ROADMAP_GENERATED);
            goalRepo.save(goal);
        }

        return response;
    }


    // =========================================
    // GET ALL GOALS FOR AUTHENTICATED USER
    // =========================================

    public List<GoalSummaryDTO> getAllGoals(UUID userId) {

        return goalRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(goal -> {

                    Integer totalDays = null;
                    Long completedDays = null;

                    if (goal.getStatus() == GoalStatus.ROADMAP_GENERATED) {

                        var roadmap =
                                roadmapRepo.findByUserGoalId(goal.getId());

                        if (roadmap.isPresent()) {

                            totalDays = roadmap.get().getTotalDays();

                            completedDays =
                                    dayPlanRepo.countByRoadmapIdAndIsCompleted(
                                            roadmap.get().getId(),
                                            true
                                    );
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
    }


    // =========================================
    // MARK ROADMAP DAY AS COMPLETED
    // =========================================

    public void markDayComplete(
            UUID goalId,
            Integer dayNumber,
            UUID userId) {

        log.debug(
                "Marking day complete: goalId={}, dayNumber={}",
                goalId,
                dayNumber
        );

        // Verify goal ownership
        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Goal not found or access denied"
                        )
                );

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() ->
                        new RuntimeException("Roadmap not found for this goal")
                );

        roadmapService.markDayCompleted(
                roadmap.getId(),
                dayNumber
        );
    }


    // =========================================
    // GET ROADMAP DAYS
    // =========================================

    public Map<String, Object> getRoadmapDays(
            UUID goalId,
            UUID userId) {

        log.debug("Fetching roadmap days for goalId={}", goalId);

        // Verify goal ownership
        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() ->
                        new RuntimeException("Goal not found")
                );

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() ->
                        new RuntimeException("Roadmap not found")
                );

        List<DayPlan> days =
                dayPlanRepo.findByRoadmapIdOrderByDayNumberAsc(
                        roadmap.getId()
                );

        Map<String, Object> response = new HashMap<>();

        response.put("goalId", goalId);

        response.put(
                "days",
                days.stream().map(day -> {

                    Map<String, Object> dayData = new HashMap<>();

                    dayData.put("day", day.getDayNumber());
                    dayData.put("main_topic", day.getMainTopic());
                    dayData.put("sub_topics", day.getSubTopics());
                    dayData.put("daily_goal", day.getDailyGoal());
                    dayData.put("completed", day.getIsCompleted());

                    Map<String, String> hours = new HashMap<>();

                    hours.put("theory", day.getTheoryHours());
                    hours.put("practice", day.getPracticeHours());

                    dayData.put("hours_allocation", hours);

                    return dayData;

                }).toList()
        );

        return response;
    }


    // =========================================
    // AI MENTOR CHAT
    // =========================================

    public Map<String, String> askMentor(
            Map<String, String> body) {

        String prompt = buildMentorPrompt(body);

        String aiResponse = aiService.askQuestion(prompt);

        Map<String, String> response = new HashMap<>();

        response.put("response", aiResponse);

        return response;
    }


// =========================================
// AI MENTOR CHAT - STREAMING RESPONSE
// =========================================

    public Flux<ServerSentEvent<String>> streamMentor(
            Map<String, String> body,
            UUID userId) {

        if (userId == null) {
            return Flux.error(
                    new IllegalArgumentException(
                            "Authenticated user is required"
                    )
            );
        }

        String prompt = buildMentorPrompt(body);

        return aiStreamingClient.stream(prompt);
    }


// =========================================
// SHARED MENTOR PROMPT BUILDER
// =========================================

    private String buildMentorPrompt(
            Map<String, String> body) {

        if (body == null) {
            throw new IllegalArgumentException(
                    "Chat request cannot be empty"
            );
        }

        String message = body.get("message");

        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException(
                    "Message cannot be empty"
            );
        }

        if (message.length() > 4000) {
            throw new IllegalArgumentException(
                    "Message cannot exceed 4000 characters"
            );
        }

        String lessonTitle = body.getOrDefault(
                "lessonTitle",
                "Current lesson"
        );

        String lessonContent = body.getOrDefault(
                "lessonContent",
                ""
        );

        if (lessonTitle == null || lessonTitle.isBlank()) {
            lessonTitle = "Current lesson";
        }

        if (lessonContent == null) {
            lessonContent = "";
        }

        if (lessonContent.length() > 20000) {
            throw new IllegalArgumentException(
                    "Lesson context cannot exceed 20000 characters"
            );
        }

        return prompts.buildChatPrompt(
                message,
                lessonTitle,
                lessonContent
        );
    }


    // =========================================
    // PRIVATE HELPER METHODS
    // =========================================

    private UserGoal getLatestGoal(UUID userId) {

        return goalRepo.findFirstByUserIdOrderByCreatedAtDesc(userId)
                .orElseThrow(() ->
                        new RuntimeException(
                                "No goal found for user. Start by calling /testSkills first."
                        )
                );
    }


    private void validateStatus(
            UserGoal goal,
            GoalStatus requiredStatus,
            String message) {

        if (goal.getStatus() != requiredStatus) {

            throw new RuntimeException(
                    message + ". Current status: " + goal.getStatus()
            );
        }
    }

}
