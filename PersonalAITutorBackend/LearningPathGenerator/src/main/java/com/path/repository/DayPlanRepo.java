package com.path.repository;

import com.path.entity.DayPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DayPlanRepo extends JpaRepository<DayPlan, Long> {

    // Used for roadmap page: get all days for a roadmap
    List<DayPlan> findByRoadmapIdOrderByDayNumberAsc(Long roadmapId);

    // Used in RoadmapService to get covered topic names (avoids loading full DayPlan)
    @Query("SELECT d.mainTopic FROM DayPlan d WHERE d.roadmap.id = :roadmapId ORDER BY d.dayNumber ASC")
    List<String> findMainTopicsByRoadmapId(Long roadmapId);

    // Used for progress tracking: how many days completed
    long countByRoadmapIdAndIsCompleted(Long roadmapId, Boolean isCompleted);

    // Get a specific day (for "open Day 5" action)
    Optional<DayPlan> findByRoadmapIdAndDayNumber(Long roadmapId, Integer dayNumber);
}