package com.path.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class RoadmapResponse {

    private String goal;

    @JsonProperty("start_day")
    private int startDay;

    @JsonProperty("end_day")
    private int endDay;

    private List<DayPlanDTO> roadmap;

    private Boolean degraded = false;
    private String message;

    @Data
    public static class DayPlanDTO {
        private Integer day;

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
