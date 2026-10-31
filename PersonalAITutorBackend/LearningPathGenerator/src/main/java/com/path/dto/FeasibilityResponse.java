package com.path.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * IMPORTANT: Use Boolean (wrapper) NOT boolean (primitive).
 * With Lombok @Data + primitive boolean, getter becomes isFeasible()
 * → Jackson maps to "feasible" in JSON, not "isFeasible" → always null/false.
 * Boolean wrapper forces Jackson to use the field name directly.
 */
@Data
public class FeasibilityResponse {

    @JsonProperty("isFeasible")
    private Boolean isFeasible;

    private int estimatedDaysRequired;

    // "foundation" | "intermediate" | "job-ready"
    private String expectedOutcome;

    private String reason;
}