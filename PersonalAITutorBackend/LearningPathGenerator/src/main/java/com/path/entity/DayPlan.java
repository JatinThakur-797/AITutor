package com.path.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One row = one day of learning.
 * Many DayPlans belong to one Roadmap.
 */
@Entity
@Table(name = "day_plans", indexes = {
        @Index(name = "idx_day_plans_roadmap_id", columnList = "roadmap_id"),
        @Index(name = "idx_day_plans_day_number", columnList = "dayNumber")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DayPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer dayNumber;

    @Column(nullable = false)
    private String mainTopic;

    // Stored as separate table rows (sub_topics table)
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "day_plan_sub_topics",
            joinColumns = @JoinColumn(name = "day_plan_id"))
    @Column(name = "sub_topic")
    private List<String> subTopics;

    private String theoryHours;
    private String practiceHours;

    @Column(length = 1000)
    private String dailyGoal;

    // ─── Progress tracking ───
    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted = false;

    private LocalDateTime completedAt; // Set when user marks as done
    @Column(columnDefinition = "LONGTEXT")
    private String lessonContent;

    private String taskType; // QUIZ, CODING, or ACTIVITY

    @Column(columnDefinition = "JSON") // Or TEXT if using standard MySQL/Postgres without JSON type
    private String taskData;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "roadmap_id", nullable = false)
    private Roadmap roadmap;
}