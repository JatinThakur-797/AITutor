package com.path.repository;

import com.path.entity.Roadmap;
import com.path.entity.UserGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoadmapRepo extends JpaRepository<Roadmap, Long> {

    // Fetch roadmap for a specific goal
    Optional<Roadmap> findByUserGoal(UserGoal userGoal);

    // Fetch roadmap by goal ID directly (avoids loading UserGoal first)
    Optional<Roadmap> findByUserGoalId(UUID userGoalId);

    // Get all roadmaps for a user (for sidebar list with day count)
    @Query("SELECT r FROM Roadmap r JOIN r.userGoal g WHERE g.userId = :userId ORDER BY r.createdAt DESC")
    List<Roadmap> findAllByUserId(UUID userId);
}