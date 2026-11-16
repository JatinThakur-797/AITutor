
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
import org.springframework.stereotype.Service;

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

        // Save AI-assessed level
        goal.setAssignedLevel(report.getAssignedLevel());
        goalRepo.save(goal);

        // Generate feasibility analysis
        FeasibilityResponse response =
                aiService.checkFeasibility(goal);

        // Persist feasibility result
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

        UserGoal goal = getLatestGoal(userId);

        // Allow initial generation and subsequent chunks
        if (goal.getStatus() != GoalStatus.FEASIBILITY_DONE &&
                goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {

            throw new RuntimeException(
                    "Feasibility check must be completed before roadmap generation. Current status: "
                            + goal.getStatus()
            );
        }

        Roadmap roadmap = getOrCreateRoadmap(goal);

        // Fetch previously covered topics
        List<String> coveredTopics =
                roadmapService.getCoveredTopics(roadmap);

        // Build AI prompt
        String prompt = prompts.buildRoadmapPromptWithMemory(
                goal,
                startDay,
                days,
                coveredTopics
        );

        // Generate roadmap
        RoadmapResponse response =
                aiService.generateRoadmap(prompt);

        // Save only successful AI responses
        if (!Boolean.TRUE.equals(response.getDegraded())) {

            roadmapService.saveRoadmapChunk(
                    roadmap,
                    response.getRoadmap()
            );

            if (goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {
                goal.setStatus(GoalStatus.ROADMAP_GENERATED);
                goalRepo.save(goal);
            }
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

        String message = body.get("message");
        String lessonTitle = body.get("lessonTitle");
        String lessonContent = body.get("lessonContent");

        if (message == null || message.isBlank()) {
            throw new RuntimeException("Message cannot be empty");
        }

        String prompt = prompts.buildChatPrompt(
                message,
                lessonTitle,
                lessonContent
        );

        String aiResponse = aiService.askQuestion(prompt);

        Map<String, String> response = new HashMap<>();

        response.put("response", aiResponse);

        return response;
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


    private Roadmap getOrCreateRoadmap(UserGoal goal) {

        return roadmapRepo.findByUserGoal(goal)
                .orElseGet(() -> {

                    Roadmap roadmap = new Roadmap();

                    roadmap.setUserGoal(goal);

                    roadmap.setTotalDays(
                            goal.getDuration() * 30
                    );

                    roadmap.setMode(
                            computeMode(goal)
                    );

                    return roadmapRepo.save(roadmap);
                });
    }


    private String computeMode(UserGoal goal) {

        boolean feasible = Boolean.TRUE.equals(goal.getFeasible());

        if (!feasible) {
            return "FAST";
        }

        int totalDays = goal.getDuration() * 30;

        int estimated = goal.getEstimatedDaysRequired() != null
                ? goal.getEstimatedDaysRequired()
                : totalDays;

        return totalDays <= estimated * 1.2
                ? "MEDIUM"
                : "NATURAL";
    }
}
