package com.path.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

/**
 * Keep snake_case @JsonProperty for AI JSON mapping,
 * but Java fields are camelCase (clean code standard).
 */
@Data
public class RoadmapResponse {

    private String goal;

    @JsonProperty("start_day")
    private int startDay;

    @JsonProperty("end_day")
    private int endDay;

    private List<DayPlanDTO> roadmap;

    @Data
    public static class DayPlanDTO {
        private int day;

        @JsonProperty("main_topic")
        private String mainTopic;

        @JsonProperty("sub_topics")
        private List<String> subTopics;

        @JsonProperty("hours_allocation")
        private Hours hoursAllocation;

        @JsonProperty("daily_goal")
        private String dailyGoal;
    }

    @Data
    public static class Hours {
        private String theory;
        private String practice;
    }
}