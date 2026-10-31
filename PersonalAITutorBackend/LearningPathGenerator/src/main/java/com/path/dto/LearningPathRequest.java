package com.path.dto;

import lombok.Data;

@Data
public class LearningPathRequest {
    private String currentSkills;
    private String careerGoal;
    private String learningStyle;
    private String difficultyLevel;
    private String preferredDuration;
}
