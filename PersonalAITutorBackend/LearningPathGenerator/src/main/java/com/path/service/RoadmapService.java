package com.path.service;

import com.path.dto.RoadmapResponse;
import com.path.entity.DayPlan;
import com.path.entity.Roadmap;
import com.path.repository.DayPlanRepo;
import com.path.repository.RoadmapRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

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
    public void saveRoadmapChunk(Roadmap roadmap, List<RoadmapResponse.DayPlanDTO> dtoList) {
        if (dtoList == null || dtoList.isEmpty()) return;

        List<DayPlan> dayPlans = dtoList.stream().map(dto -> {
            DayPlan dp = new DayPlan();
            dp.setDayNumber(dto.getDay());
            dp.setMainTopic(dto.getMainTopic());
            dp.setSubTopics(dto.getSubTopics() != null ? dto.getSubTopics() : List.of());

            if (dto.getHoursAllocation() != null) {
                dp.setTheoryHours(dto.getHoursAllocation().getTheory());
                dp.setPracticeHours(dto.getHoursAllocation().getPractice());
            }

            dp.setDailyGoal(dto.getDailyGoal());
            dp.setRoadmap(roadmap);
            return dp;
        }).toList();

        dayPlanRepo.saveAll(dayPlans);
    }

    /**
     * Mark a day as completed (for progress tracking / leaderboard)
     */
    @Transactional
    public void markDayCompleted(Long roadmapId, Integer dayNumber) {
        System.out.println("roadMap Id + " + roadmapId + "dayNumber : " + dayNumber);
        dayPlanRepo.findByRoadmapIdAndDayNumber(roadmapId, dayNumber)
                .ifPresent(day -> {
                    day.setIsCompleted(true);
                    day.setCompletedAt(java.time.LocalDateTime.now());
                    dayPlanRepo.save(day);
                });
    }

    /**
     * Get progress percentage for a roadmap
     */
    @Transactional(readOnly = true)
    public double getProgressPercent(Long roadmapId, int totalDays) {
        long completed = dayPlanRepo.countByRoadmapIdAndIsCompleted(roadmapId, true);
        return totalDays > 0 ? (completed * 100.0 / totalDays) : 0;
    }
}