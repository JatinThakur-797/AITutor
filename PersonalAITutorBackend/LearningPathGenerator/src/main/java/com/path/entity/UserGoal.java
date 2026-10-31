package com.path.entity;

import com.path.dto.UserRequest;
import com.path.enums.GoalStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents ONE learning goal for ONE user.
 * A single user can have MANY UserGoals (Java, MERN, Python etc.)
 * This replaces the old "UserDetails" entity.
 */
@Entity
@Table(name = "user_goals", indexes = {
        @Index(name = "idx_user_goals_user_id", columnList = "userId"),
        @Index(name = "idx_user_goals_created_at", columnList = "createdAt")
})
@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // ─── Who owns this goal (comes from Auth service JWT) ───
    @Column(nullable = false)
    private UUID userId;

    // ─── Step 1: User fills the form ───
    @Column(nullable = false)
    private String goal;

    @Column(nullable = false)
    private String currentLevel;

    @Column(nullable = false)
    private Integer timePerDay;     // hours per day

    @Column(nullable = false)
    private Integer duration;       // in months

    // ─── Step 2: After quiz result comes back ───
    private String assignedLevel;   // AI-assessed level from quiz

    // ─── Step 3: After feasibility check ───
    private Boolean feasible;
    private Integer estimatedDaysRequired;
    private String expectedOutcome;
    // "foundation" | "intermediate" | "job-ready"
    @Column(columnDefinition = "LONGTEXT")
    @Lob
    private String feasibilityReason;

    // ─── Goal pipeline status (guards step ordering) ───
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoalStatus status = GoalStatus.QUIZ_PENDING;

    // ─── Timestamps ───
    @CreationTimestamp
    @Column(updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Convenience setter from request ───
    public void setFromRequest(UserRequest request) {
        this.goal = request.getGoal();
        this.currentLevel = request.getCurrentLevel();
        this.timePerDay = request.getTimePerDay();
        this.duration = request.getDuration();
    }
}