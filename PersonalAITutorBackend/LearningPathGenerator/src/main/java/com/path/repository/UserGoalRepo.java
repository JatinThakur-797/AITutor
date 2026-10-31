package com.path.repository;

import com.path.entity.UserGoal;
import com.path.enums.GoalStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserGoalRepo extends JpaRepository<UserGoal, UUID> {

    // Used by the sidebar — all goals for a user, newest first
    List<UserGoal> findByUserIdOrderByCreatedAtDesc(UUID userId);

    // Used in feasibility + roadmap steps to fetch the active goal
    Optional<UserGoal> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);

    // Fetch a specific goal by its own ID + verify ownership (security)
    Optional<UserGoal> findByIdAndUserId(UUID id, UUID userId);

    // Check if user already has a ROADMAP_GENERATED goal for same goal string
    // Useful for caching: if same goal exists, reuse roadmap instead of regenerating
    Optional<UserGoal> findFirstByUserIdAndGoalIgnoreCaseAndStatus(
            UUID userId, String goal, GoalStatus status);

    // Count how many goals a user has (for profile stats)
    long countByUserId(UUID userId);
}