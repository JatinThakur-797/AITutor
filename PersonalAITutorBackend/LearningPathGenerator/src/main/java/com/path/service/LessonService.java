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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LessonService {

    private static final Logger log = LoggerFactory.getLogger(LessonService.class);

    private final UserGoalRepo goalRepo;
    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;
    private final AIService aiService;
    private final PromptsClass prompts;
    private final TransactionTemplate transactionTemplate;

    public LessonContentDTO getOrGenerateLesson(UUID goalId, Integer dayNumber, UUID userId) {
        if (dayNumber == null || dayNumber < 1) {
            throw new IllegalArgumentException(
                    "Day number must be positive"
            );
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

        // Cached lesson: no LLM call and no write transaction required.
        if (snapshot.lessonContent() != null &&
                !snapshot.lessonContent().isBlank()) {

            Map<String, Object> cachedTask =
                    aiService.parseTaskStringToMap(snapshot.taskData());

            if (cachedTask.isEmpty()) {
                cachedTask = Map.of(
                        "instructions",
                        "Review the lesson and practice its concepts in your IDE."
                );
            }

            String cachedTaskType =
                    snapshot.taskType() == null ||
                            snapshot.taskType().isBlank()
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

        String prompt = prompts.buildLessonPrompt(
                snapshot.mainTopic(),
                snapshot.subTopics(),
                snapshot.currentLevel(),
                snapshot.goal()
        );

        // No database transaction is held while waiting for the remote AI provider.
        LessonResponse generated = aiService.generateLesson(prompt);

        if (generated == null || Boolean.TRUE.equals(generated.getDegraded())) {
            log.warn("Lesson generation returned degraded content for day {}", dayNumber);
            return fallbackDto(snapshot, generated);
        }

        if (generated.getLesson() == null || generated.getLesson().isBlank()) {
            log.warn("AI returned an empty lesson for day {}", dayNumber);
            return fallbackDto(snapshot, null);
        }

        LessonResponse.TaskDTO task = generated.getTask();
        String taskType = "ACTIVITY";
        Map<String, Object> taskContent = Map.of(
                "instructions",
                "Review the lesson and practice its concepts in your IDE."
        );

        if (task != null) {
            if (task.getType() != null && !task.getType().isBlank()) {
                taskType = task.getType().toUpperCase();
            }
            if (task.getContent() != null && !task.getContent().isEmpty()) {
                taskContent = task.getContent();
            }
        }

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

    private LessonContentDTO fallbackDto(LessonSnapshot snapshot, LessonResponse generated) {
        String lesson = generated != null && generated.getLesson() != null
                ? generated.getLesson()
                : "# Content Temporarily Unavailable\n\nPlease try refreshing the page.";

        Map<String, Object> taskContent = generated != null
                && generated.getTask() != null
                && generated.getTask().getContent() != null
                ? generated.getTask().getContent()
                : Map.of("instructions", "Review your notes for this topic and practice in your IDE.");

        String taskType = generated != null
                && generated.getTask() != null
                && generated.getTask().getType() != null
                ? generated.getTask().getType()
                : "ACTIVITY";

        return toDto(snapshot, lesson, taskType, taskContent, true);
    }

    private LessonContentDTO toDto(
            LessonSnapshot snapshot,
            String lesson,
            String taskType,
            Map<String, Object> taskContent,
            boolean degraded) {
        return new LessonContentDTO(
                snapshot.mainTopic(),
                snapshot.subTopics(),
                lesson,
                taskType,
                taskContent,
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
