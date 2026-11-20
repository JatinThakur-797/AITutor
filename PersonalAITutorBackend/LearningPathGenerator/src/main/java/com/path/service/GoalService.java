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
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

    // Prevents duplicate concurrent LLM calls if user double-clicks roadmap generation
    private final ConcurrentHashMap<UUID, Object> goalLocks = new ConcurrentHashMap<>();


    // =========================================
    // STEP 1: GENERATE QUIZ (FAILS FAST WITH 503 IF AI IS DOWN)
    // =========================================

    public QuizResponse generateQuiz(
            UserRequest request,
            UUID userId) {

        log.debug("Generating quiz for userId={}", userId);

        String prompt = prompts.buildQuizPrompt(request);
        QuizResponse quizResponse = aiService.generateQuiz(prompt);

        // Fix #1: Do NOT save an orphan UserGoal or return a fake 3-question quiz when AI is down
        if (quizResponse == null || Boolean.TRUE.equals(quizResponse.getDegraded())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    AIService.DEGRADED_MESSAGE
            );
        }

        UserGoal goal = new UserGoal();
        goal.setUserId(userId);
        goal.setFromRequest(request);
        goal.setStatus(GoalStatus.QUIZ_PENDING);
        goal = goalRepo.save(goal);

        // Return goalId in message/metadata if needed by frontend
        quizResponse.setGoal(goal.getGoal());
        return quizResponse;
    }


    // =========================================
    // STEP 2: CHECK FEASIBILITY (IDEMPOTENT + 503 ON AI FAILURE)
    // =========================================

    public FeasibilityResponse checkFeasibility(
            Report report,
            UUID userId,
            UUID goalId) {

        UserGoal goal = (goalId != null)
                ? goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"))
                : getLatestGoal(userId);

        // Idempotency fix: if feasibility is already computed (e.g., user refreshed page),
        // return the persisted feasibility result instead of throwing an exception.
        if (goal.getStatus() == GoalStatus.FEASIBILITY_DONE
                || goal.getStatus() == GoalStatus.ROADMAP_GENERATED) {

            FeasibilityResponse cached = new FeasibilityResponse();
            cached.setIsFeasible(goal.getFeasible());
            cached.setEstimatedDaysRequired(
                    goal.getEstimatedDaysRequired() != null
                            ? goal.getEstimatedDaysRequired()
                            : goal.getDuration() * 30
            );
            cached.setExpectedOutcome(
                    goal.getExpectedOutcome() != null
                            ? goal.getExpectedOutcome()
                            : "foundation"
            );
            cached.setReason(goal.getFeasibilityReason());
            cached.setDegraded(false);
            return cached;
        }

        validateStatus(
                goal,
                GoalStatus.QUIZ_PENDING,
                "Quiz must be completed before feasibility check"
        );

        String resolvedLevel = (report != null && report.getAssignedLevel() != null && !report.getAssignedLevel().isBlank())
                ? report.getAssignedLevel()
                : goal.getCurrentLevel();

        goal.setAssignedLevel(resolvedLevel);
        goalRepo.save(goal);

        FeasibilityResponse response =
                aiService.checkFeasibility(goal);

        // Fix #1: Throw 503 instead of returning a silent degraded response
        if (response == null || Boolean.TRUE.equals(response.getDegraded())) {
            log.warn("Feasibility generation degraded for goal {}", goal.getId());
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    AIService.DEGRADED_MESSAGE
            );
        }

        goal.setFeasible(response.getIsFeasible());
        goal.setEstimatedDaysRequired(response.getEstimatedDaysRequired());
        goal.setExpectedOutcome(response.getExpectedOutcome());
        goal.setFeasibilityReason(response.getReason());
        goal.setStatus(GoalStatus.FEASIBILITY_DONE);

        goalRepo.save(goal);

        return response;
    }


    // =========================================
    // STEP 3: GENERATE ROADMAP (CONCURRENCY LOCK + 80% GATE + 503 ON AI FAILURE)
    // =========================================

    public RoadmapResponse generateRoadmap(
            UUID userId,
            UUID goalId,
            int startDay,
            int days) {

        if (startDay < 1 || days < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "startDay and days must be positive"
            );
        }

        UserGoal goal = (goalId != null)
                ? goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"))
                : getLatestGoal(userId);

        Object lock = goalLocks.computeIfAbsent(goal.getId(), k -> new Object());

        synchronized (lock) {
            try {
                // Re-fetch fresh state inside lock
                goal = goalRepo.findById(goal.getId()).orElseThrow();

                if (goal.getStatus() != GoalStatus.FEASIBILITY_DONE &&
                        goal.getStatus() != GoalStatus.ROADMAP_GENERATED) {

                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Feasibility check must be completed before roadmap generation. Current status: " + goal.getStatus()
                    );
                }

                Roadmap roadmap = roadmapRepo.findByUserGoal(goal).orElse(null);

                if (roadmap != null) {
                    List<DayPlan> existingDays =
                            dayPlanRepo.findByRoadmapIdOrderByDayNumberAsc(roadmap.getId());

                    if (!existingDays.isEmpty()) {
                        int maxGeneratedDay = existingDays.stream()
                                .mapToInt(DayPlan::getDayNumber)
                                .max()
                                .orElse(0);

                        // Fix #2: Prevent duplicate/overlapping generation if user double-clicked
                        if (startDay <= maxGeneratedDay) {
                            throw new ResponseStatusException(
                                    HttpStatus.CONFLICT,
                                    "Days up to Day " + maxGeneratedDay + " are already generated. Refresh the roadmap to view them."
                            );
                        }

                        // Enforce 80% completion of existing days before generating the next 7-day block
                        long completedCount = existingDays.stream()
                                .filter(d -> Boolean.TRUE.equals(d.getIsCompleted()))
                                .count();
                        int requiredToUnlock = (int) Math.ceil(existingDays.size() * 0.8);

                        if (completedCount < requiredToUnlock) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    String.format(
                                            "Complete at least %d of %d current lessons (80%%) before generating the next %d days. Currently completed: %d.",
                                            requiredToUnlock,
                                            existingDays.size(),
                                            days,
                                            completedCount
                                    )
                            );
                        }
                    }
                }

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

                // Fix #1: Throw 503 instead of returning an unsaved dummy roadmap
                if (response == null || !Boolean.FALSE.equals(response.getDegraded())) {
                    log.warn("Roadmap generation failed or degraded for goal {}", goal.getId());
                    throw new ResponseStatusException(
                            HttpStatus.SERVICE_UNAVAILABLE,
                            AIService.DEGRADED_MESSAGE
                    );
                }

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
            } finally {
                goalLocks.remove(goal.getId(), lock);
            }
        }
    }


    // =========================================
    // GET SINGLE GOAL DETAILS (FOR RESUMING PROGRESS)
    // =========================================

    public Map<String, Object> getGoalDetails(UUID goalId, UUID userId) {
        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"));

        Map<String, Object> data = new HashMap<>();
        data.put("id", goal.getId());
        data.put("goal", goal.getGoal());
        data.put("currentLevel", goal.getCurrentLevel());
        data.put("assignedLevel", goal.getAssignedLevel());
        data.put("timePerDay", goal.getTimePerDay());
        data.put("duration", goal.getDuration());
        data.put("status", goal.getStatus());

        if (goal.getStatus() == GoalStatus.FEASIBILITY_DONE
                || goal.getStatus() == GoalStatus.ROADMAP_GENERATED) {
            FeasibilityResponse feasibility = new FeasibilityResponse();
            feasibility.setIsFeasible(goal.getFeasible());
            feasibility.setEstimatedDaysRequired(
                    goal.getEstimatedDaysRequired() != null
                            ? goal.getEstimatedDaysRequired()
                            : goal.getDuration() * 30
            );
            feasibility.setExpectedOutcome(
                    goal.getExpectedOutcome() != null
                            ? goal.getExpectedOutcome()
                            : "foundation"
            );
            feasibility.setReason(goal.getFeasibilityReason());
            feasibility.setDegraded(false);
            data.put("feasibility", feasibility);
        }

        return data;
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

        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Goal not found or access denied"
                        )
                );

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Roadmap not found for this goal")
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

        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found")
                );

        Roadmap roadmap = roadmapRepo.findByUserGoal(goal)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Roadmap not found")
                );

        List<DayPlan> days =
                dayPlanRepo.findByRoadmapIdOrderByDayNumberAsc(
                        roadmap.getId()
                );

        Map<String, Object> response = new HashMap<>();

        response.put("goalId", goalId);
        response.put("goalTitle", goal.getGoal());
        response.put("totalTargetDays", roadmap.getTotalDays());

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
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No goal found for user. Start by calling /testSkills first."
                        )
                );
    }


    private void validateStatus(
            UserGoal goal,
            GoalStatus requiredStatus,
            String message) {

        if (goal.getStatus() != requiredStatus) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    message + ". Current status: " + goal.getStatus()
            );
        }
    }
    @Transactional
    public void deleteGoal(UUID userId, UUID goalId) {
        Object lock = goalLocks.computeIfAbsent(goalId, k -> new Object());
        synchronized (lock) {
            try {
                UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND, "Learning path not found"));

                roadmapRepo.findByUserGoal(goal).ifPresent(roadmap -> {
                    dayPlanRepo.deleteByRoadmapId(roadmap.getId());
                    roadmapRepo.delete(roadmap);
                });

                goalRepo.delete(goal);
            } finally {
                goalLocks.remove(goalId, lock);
            }
        }
    }

}