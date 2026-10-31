package com.path.dto;

import com.path.enums.GoalStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lightweight DTO for the sidebar list.
 * Never expose the full entity — only what the UI needs.
 */
@Data
@AllArgsConstructor
public class GoalSummaryDTO {

    private UUID goalId;
    private String goal;
    private String currentLevel;
    private String assignedLevel;
    private Integer duration;           // months
    private GoalStatus status;
    private Boolean feasible;
    private String expectedOutcome;
    private LocalDateTime createdAt;

    // Roadmap progress (null if roadmap not generated yet)
    private Integer totalDays;
    private Long completedDays;
}