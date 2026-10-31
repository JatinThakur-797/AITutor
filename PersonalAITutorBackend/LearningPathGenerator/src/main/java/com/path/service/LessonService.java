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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LessonService {

    private final UserGoalRepo goalRepo;
    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;
    private final AIService aiService;
    private final PromptsClass prompts;

    @Transactional // Ensures atomicity and provides basic thread-safety for the DB operations
    public LessonContentDTO getOrGenerateLesson(UUID goalId, Integer dayNumber, UUID userId) {

        UserGoal goal = goalRepo.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));

        Roadmap roadmap = roadmapRepo.findByUserGoalId(goal.getId())
                .orElseThrow(() -> new RuntimeException("Roadmap not found"));

        DayPlan dayPlan = dayPlanRepo.findByRoadmapIdAndDayNumber(roadmap.getId(), dayNumber)
                .orElseThrow(() -> new RuntimeException("Day " + dayNumber + " not found"));

        boolean isFallback = false;

        // JIT Generation Check
        if (dayPlan.getLessonContent() == null || dayPlan.getLessonContent().isBlank()) {
            try {
                String prompt = prompts.buildLessonPrompt(
                        dayPlan.getMainTopic(),
                        dayPlan.getSubTopics(),
                        goal.getCurrentLevel(),
                        goal.getGoal()
                );

                // If this throws an exception, the execution jumps to the catch block BEFORE saving to DB
                LessonResponse newLesson = aiService.generateLesson(prompt);

                dayPlan.setLessonContent(newLesson.getLesson());
                dayPlan.setTaskType(newLesson.getTask().getType());
                dayPlan.setTaskData(aiService.convertTaskMapToString(newLesson.getTask().getContent()));

                dayPlanRepo.save(dayPlan);

            } catch (Exception e) {
                // AI Failed. We catch it here to provide a good UX, but WE DO NOT SAVE TO DB.
               System.out.println("Serving fallback content for Day {} due to AI failure." + dayNumber + " exception :" + e.getMessage());
                isFallback = true;

                return new LessonContentDTO(
                        dayPlan.getMainTopic(),
                        dayPlan.getSubTopics(),
                        "# Content Temporarily Unavailable\n\nPlease try refreshing the page.",
                        "ACTIVITY",
                        Map.of("instructions", "Review your notes for this topic and practice in your IDE."),
                        true
                );
            }
        }

        // Return the successfully generated (or previously cached) lesson
        return new LessonContentDTO(
                dayPlan.getMainTopic(),
                dayPlan.getSubTopics(),
                dayPlan.getLessonContent(),
                dayPlan.getTaskType(),
                aiService.parseTaskStringToMap(dayPlan.getTaskData()),
                isFallback
        );
    }
}