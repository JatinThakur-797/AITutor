package com.path.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserRequest {

    @org.hibernate.validator.constraints.NotBlank(message = "Goal cannot be empty")
    private String goal;

    @NotBlank(message = "Current level cannot be empty")
    private String currentLevel;

    @NotNull(message = "Time per day is required")
    @Min(value = 1, message = "Minimum 1 hour per day")
    @Max(value = 16, message = "Maximum 16 hours per day")
    private Integer timePerDay;

    @NotNull(message = "Duration is required")
    @Min(value = 1, message = "Minimum 1 month")
    @Max(value = 24, message = "Maximum 24 months")
    private Integer duration; // in months
}