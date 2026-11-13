package com.path.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class FeasibilityResponse {

    @JsonProperty("isFeasible")
    private Boolean isFeasible;

    private int estimatedDaysRequired;

    // "foundation" | "intermediate" | "job-ready"
    private String expectedOutcome;

    private String reason;

    private Boolean degraded = false;
}
