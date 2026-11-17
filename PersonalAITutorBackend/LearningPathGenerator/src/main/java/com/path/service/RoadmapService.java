package com.path.service;

import com.path.dto.RoadmapResponse;
import com.path.entity.DayPlan;
import com.path.entity.Roadmap;
import com.path.entity.UserGoal;
import com.path.repository.DayPlanRepo;
import com.path.repository.RoadmapRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class RoadmapService {

    private final RoadmapRepo roadmapRepo;
    private final DayPlanRepo dayPlanRepo;

    /**
     * Use optimized query — avoids LazyInitializationException
     * that the old roadmap.getDays() caused.
     */
    @Transactional(readOnly = true)
    public List<String> getCoveredTopics(Roadmap roadmap) {
        if (roadmap.getId() == null) {
            return Collections.emptyList();
        }
        // Direct DB query — no lazy loading issues
        return dayPlanRepo.findMainTopicsByRoadmapId(roadmap.getId());
    }

    @Transactional
    public void saveRoadmapChunk(
            Roadmap roadmap,
            List<RoadmapResponse.DayPlanDTO> dtoList) {

        if (roadmap == null || roadmap.getId() == null) {
            throw new IllegalArgumentException(
                    "A persisted roadmap is required"
            );
        }

        if (dtoList == null || dtoList.isEmpty()) {
            return;
        }

        Set<Integer> processedDays = new HashSet<>();
        List<DayPlan> dayPlans = new ArrayList<>();

        for (RoadmapResponse.DayPlanDTO dto : dtoList) {

            if (dto == null || dto.getDay() == null ||
                    dto.getDay() < 1) {
                throw new IllegalArgumentException(
                        "Every roadmap day must have a valid day number"
                );
            }

            if (!processedDays.add(dto.getDay())) {
                throw new IllegalArgumentException(
                        "Duplicate day number in generated chunk: " + dto.getDay()
                );
            }

            // Update an existing day or create a new one.
            DayPlan dayPlan = dayPlanRepo
                    .findByRoadmapIdAndDayNumber(
                            roadmap.getId(),
                            dto.getDay()
                    )
                    .orElseGet(DayPlan::new);

            dayPlan.setDayNumber(dto.getDay());
            dayPlan.setMainTopic(dto.getMainTopic());

            dayPlan.setSubTopics(
                    dto.getSubTopics() != null
                            ? dto.getSubTopics()
                            : List.of()
            );

            if (dto.getHoursAllocation() != null) {
                dayPlan.setTheoryHours(
                        dto.getHoursAllocation().getTheory()
                );

                dayPlan.setPracticeHours(
                        dto.getHoursAllocation().getPractice()
                );
            }

            dayPlan.setDailyGoal(dto.getDailyGoal());
            dayPlan.setRoadmap(roadmap);

            if (dayPlan.getIsCompleted() == null) {
                dayPlan.setIsCompleted(false);
            }

            dayPlans.add(dayPlan);
        }

        dayPlanRepo.saveAll(dayPlans);
    }

    /**
     * Mark a day as completed (for progress tracking / leaderboard)
     */
    @Transactional
    public void markDayCompleted(
            Long roadmapId,
            Integer dayNumber) {

        DayPlan day = dayPlanRepo
                .findByRoadmapIdAndDayNumber(
                        roadmapId,
                        dayNumber
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Roadmap day not found: " + dayNumber
                        )
                );

        if (Boolean.TRUE.equals(day.getIsCompleted())) {
            return;
        }

        day.setIsCompleted(true);
        day.setCompletedAt(
                java.time.LocalDateTime.now()
        );

        dayPlanRepo.save(day);
    }

    /**
     * Get progress percentage for a roadmap
     */
    @Transactional(readOnly = true)
    public double getProgressPercent(Long roadmapId, int totalDays) {
        long completed = dayPlanRepo.countByRoadmapIdAndIsCompleted(roadmapId, true);
        return totalDays > 0 ? (completed * 100.0 / totalDays) : 0;
    }

    @Transactional
    public Roadmap getOrCreateRoadmap(UserGoal goal) {
        return roadmapRepo.findByUserGoal(goal)
                .orElseGet(() -> {
                    Roadmap roadmap = new Roadmap();

                    roadmap.setUserGoal(goal);
                    roadmap.setTotalDays(goal.getDuration() * 30);
                    roadmap.setMode(computeMode(goal));

                    return roadmapRepo.save(roadmap);
                });
    }

    private String computeMode(UserGoal goal) {
        boolean feasible = Boolean.TRUE.equals(goal.getFeasible());
        if (!feasible) return "FAST";
        int totalDays = goal.getDuration() * 30;
        int estimated = goal.getEstimatedDaysRequired() != null ? goal.getEstimatedDaysRequired() : totalDays;
        return totalDays <= estimated * 1.2 ? "MEDIUM" : "NATURAL";
    }
}