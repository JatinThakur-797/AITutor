package com.path.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One Roadmap per UserGoal (OneToOne).
 * Contains all DayPlans for that goal.
 */
@Entity
@Table(name = "roadmaps")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Roadmap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Each goal has exactly ONE roadmap
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_goal_id", nullable = false, unique = true)
    private UserGoal userGoal;

    // FAST | MEDIUM | NATURAL — stored so we don't recompute
    private String mode;

    private Integer totalDays;

    @CreationTimestamp
    @Column(updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "roadmap", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("dayNumber ASC")
    private List<DayPlan> days = new ArrayList<>();
}