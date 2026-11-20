package com.path.service;

import com.path.dto.LessonContentDTO;
import com.path.dto.LessonResponse;
import com.path.entity.DayPlan;
import com.path.entity.Roadmap;
import com.path.entity.UserGoal;
import com.path.prompts.PromptsClass;
import com.path.repository.DayPlanRepo;
import com.path.repository.RoadmapRepo;
import com.path.repository.UserGoalRepo;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LessonService {

    private static final Logger log = LoggerFactory.getLogger(LessonService.class);

    private static final String DEFAULT_TASK_INSTRUCTIONS =
            "Review the lesson and practice its concepts in your IDE.";

    private final LessonResourceService lessonResourceService;
    private final UserGoalRepo goalRepo;
    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;
    private final AIService aiService;
    private final PromptsClass prompts;
    private final TransactionTemplate transactionTemplate;

    public LessonContentDTO getOrGenerateLesson(UUID goalId, Integer dayNumber, UUID userId) {
        if (dayNumber == null || dayNumber < 1) {
            throw new IllegalArgumentException("Day number must be positive");
        }

        // Transaction 1: load and copy the minimum data required for prompt generation.
        // The transaction closes before the remote LLM call begins.
        LessonSnapshot snapshot = transactionTemplate.execute(status -> {
            UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("Goal not found"));

            Roadmap roadmap = roadmapRepo.findByUserGoalId(goal.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Roadmap not found"));

            DayPlan dayPlan = dayPlanRepo.findByRoadmapIdAndDayNumber(roadmap.getId(), dayNumber)
                    .orElseThrow(() -> new IllegalArgumentException("Day " + dayNumber + " not found"));

            List<String> subTopics = dayPlan.getSubTopics() == null
                    ? List.of()
                    : List.copyOf(dayPlan.getSubTopics());

            return new LessonSnapshot(
                    dayPlan.getId(),
                    dayPlan.getMainTopic(),
                    subTopics,
                    goal.getCurrentLevel(),
                    goal.getGoal(),
                    dayPlan.getLessonContent(),
                    dayPlan.getTaskType(),
                    dayPlan.getTaskData()
            );
        });

        if (snapshot == null) {
            throw new IllegalStateException("Unable to load lesson context");
        }

        // ──────────────────────────────────────────────
        // CACHED BRANCH: lesson already generated
        // ──────────────────────────────────────────────
        if (snapshot.lessonContent() != null && !snapshot.lessonContent().isBlank()) {

            // FIX: mutable map — attachFiveResourcesToTaskContent calls .put()
            Map<String, Object> cachedTask =
                    new HashMap<>(aiService.parseTaskStringToMap(snapshot.taskData()));

            if (cachedTask.isEmpty()) {
                cachedTask = new HashMap<>(Map.of(
                        "instructions",
                        DEFAULT_TASK_INSTRUCTIONS
                ));
            }

            // FIX (guitar-video bug): old cached lessons were generated with the
            // hardcoded "Learning Path" / "Lesson" context. Detect and repair
            // so those lessons get real, on-topic resources.
            if (resourcesNeedRepair(cachedTask.get("resources"))) {
                log.info(
                        "Repairing stale resources for day {} (goal='{}', topic='{}')",
                        dayNumber, snapshot.goal(), snapshot.mainTopic()
                );

                try {
                    lessonResourceService.attachFiveResourcesToTaskContent(
                            cachedTask,
                            snapshot.goal(),        // real goal — "Become a Python Developer"
                            snapshot.mainTopic()    // real topic — "Variables and Types"
                    );

                    // Persist the repaired resources so we don't re-query YouTube every time.
                    final Map<String, Object> repaired = cachedTask;
                    transactionTemplate.executeWithoutResult(status -> {
                        DayPlan dp = dayPlanRepo.findById(snapshot.dayPlanId()).orElse(null);
                        if (dp != null) {
                            dp.setTaskData(aiService.convertTaskMapToString(repaired));
                            dayPlanRepo.save(dp);
                        }
                    });
                } catch (Exception e) {
                    // Repair is best-effort; never break the cached lesson response.
                    log.warn("Resource repair failed for day {}: {}", dayNumber, e.getMessage());
                }
            }

            String cachedTaskType =
                    snapshot.taskType() == null || snapshot.taskType().isBlank()
                            ? "ACTIVITY"
                            : snapshot.taskType();

            return toDto(
                    snapshot,
                    snapshot.lessonContent(),
                    cachedTaskType,
                    cachedTask,
                    false
            );
        }

        // ──────────────────────────────────────────────
        // FRESH GENERATION BRANCH
        // ──────────────────────────────────────────────
        String prompt = prompts.buildLessonPrompt(
                snapshot.mainTopic(),
                snapshot.subTopics(),
                snapshot.currentLevel(),
                snapshot.goal()
        );

        // No database transaction is held while waiting for the remote AI provider.
        LessonResponse generated = aiService.generateLesson(prompt);

        if (generated == null || !Boolean.FALSE.equals(generated.getDegraded())) {
            log.warn("Lesson generation failed or degraded for day {}", dayNumber);
            return fallbackDto(snapshot, generated);
        }

        if (generated.getLesson() == null || generated.getLesson().isBlank()) {
            log.warn("AI returned an empty lesson for day {}", dayNumber);
            return fallbackDto(snapshot, null);
        }

        LessonResponse.TaskDTO task = generated.getTask();
        String taskType = "ACTIVITY";

        // FIX: mutable map — was Map.of(...) which throws on .put() in
        // attachFiveResourcesToTaskContent (intermittent 500 error).
        Map<String, Object> taskContent = new HashMap<>(Map.of(
                "instructions",
                DEFAULT_TASK_INSTRUCTIONS
        ));

        if (task != null) {
            if (task.getType() != null && !task.getType().isBlank()) {
                taskType = task.getType().toUpperCase();
            }
            if (task.getContent() != null && !task.getContent().isEmpty()) {
                // FIX: wrap in HashMap defensively — guarantees mutability even if
                // AIService.parseLessonTask changes its return type in the future.
                taskContent = new HashMap<>(task.getContent());
            }
        }

        // FIX (guitar-video bug): use REAL goal + topic, not the old
        // hardcoded "Learning Path" / "Lesson" strings that caused YouTube to
        // return guitar tutorials for Python lessons.
        lessonResourceService.attachFiveResourcesToTaskContent(
                taskContent,
                snapshot.goal(),        // e.g. "Become a Python Developer"
                snapshot.mainTopic()    // e.g. "Variables and Types"
        );

        final String finalTaskType = taskType;
        final Map<String, Object> finalTaskContent = taskContent;

        // Transaction 2: persist the successful response only.
        // If another request generated the same lesson concurrently, use the
        // already-persisted value instead of overwriting it.
        LessonContentDTO persisted = transactionTemplate.execute(status -> {
            DayPlan dayPlan = dayPlanRepo.findById(snapshot.dayPlanId())
                    .orElseThrow(() -> new IllegalArgumentException("Day plan no longer exists"));

            if (dayPlan.getLessonContent() == null || dayPlan.getLessonContent().isBlank()) {
                dayPlan.setLessonContent(generated.getLesson().trim());
                dayPlan.setTaskType(finalTaskType);
                dayPlan.setTaskData(aiService.convertTaskMapToString(finalTaskContent));
                dayPlanRepo.save(dayPlan);
            }

            return new LessonContentDTO(
                    dayPlan.getMainTopic(),
                    dayPlan.getSubTopics(),
                    dayPlan.getLessonContent(),
                    dayPlan.getTaskType(),
                    aiService.parseTaskStringToMap(dayPlan.getTaskData()),
                    false,
                    false
            );
        });

        if (persisted == null) {
            throw new IllegalStateException("Unable to persist generated lesson");
        }
        return persisted;
    }

    /**
     * FIX: Detect resources that should be regenerated.
     *
     * Triggers repair when:
     *   - resources key is missing or empty
     *   - any resource is a search-URL fallback (YouTube was down at generation time;
     *     we should retry now that it may be up)
     *   - any resource title has the fallback prefix "Watch: " / "Read: "
     *   - the URL contains the old hardcoded-query fingerprint "learning+path+lesson"
     *     (only appears in search-URL fallbacks generated by the buggy code)
     *
     * Note: real cached guitar videos (youtube.com/watch?v=...) cannot be
     * distinguished from real Python videos by URL alone — clear old cached
     * lessons with the SQL migration in the release notes to fully reset.
     */
    private boolean resourcesNeedRepair(Object rawResources) {
        if (!(rawResources instanceof List<?> list) || list.isEmpty()) {
            return true;
        }
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> resource)) {
                return true; // unexpected shape → regenerate
            }
            String url = String.valueOf(resource.get("url")).toLowerCase();
            String title = String.valueOf(resource.get("title"));

            if (url.contains("/results?search_query=") || url.contains("google.com/search")) {
                return true; // search-url fallback → repair
            }
            if (title.startsWith("Watch: ") || title.startsWith("Read: ")) {
                return true; // fallback title → repair
            }
            if (url.contains("learning+path+lesson")
                    || url.contains("learning%20path%20lesson")) {
                return true; // old-bug fingerprint → repair
            }
        }
        return false;
    }

    private LessonContentDTO fallbackDto(LessonSnapshot snapshot, LessonResponse generated) {
        String lesson = generated != null
                && generated.getLesson() != null
                && !generated.getLesson().isBlank()
                ? generated.getLesson()
                : "# Content Temporarily Unavailable\n\nPlease try refreshing the page.";

        // FIX: mutable map — same reason as above.
        Map<String, Object> taskContent = generated != null
                && generated.getTask() != null
                && generated.getTask().getContent() != null
                ? new HashMap<>(generated.getTask().getContent())
                : new HashMap<>(Map.of(
                "instructions",
                "Review your notes for this topic and practice in your IDE."
        ));

        String taskType = generated != null
                && generated.getTask() != null
                && generated.getTask().getType() != null
                ? generated.getTask().getType()
                : "ACTIVITY";

        // FIX: also try to attach resources on the fallback path so the user
        // isn't stuck with an empty taskData.resources when the lesson itself
        // is degraded. Attach is idempotent and falls back to search URLs.
        if (!taskContent.containsKey("resources")) {
            try {
                lessonResourceService.attachFiveResourcesToTaskContent(
                        taskContent,
                        snapshot.goal(),
                        snapshot.mainTopic()
                );
            } catch (Exception e) {
                log.warn("Could not attach resources to fallback lesson: {}", e.getMessage());
            }
        }

        return toDto(snapshot, lesson, taskType, taskContent, true);
    }

    private LessonContentDTO toDto(
            LessonSnapshot snapshot,
            String lesson,
            String taskType,
            Map<String, Object> taskContent,
            boolean degraded) {
        // FIX: defensive copy — prevents accidental post-return mutation leaking
        // into whatever holds this DTO.
        return new LessonContentDTO(
                snapshot.mainTopic(),
                snapshot.subTopics(),
                lesson,
                taskType,
                new HashMap<>(taskContent),
                degraded,
                degraded
        );
    }

    private record LessonSnapshot(
            Long dayPlanId,
            String mainTopic,
            List<String> subTopics,
            String currentLevel,
            String goal,
            String lessonContent,
            String taskType,
            String taskData
    ) {}
}