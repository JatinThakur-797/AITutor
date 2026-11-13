package com.path.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

@Component
public class AIClientFallbackFactory implements FallbackFactory<AIClient> {
    private static final Logger log = LoggerFactory.getLogger(AIClientFallbackFactory.class);
    public static final String SENTINEL_FALLBACK = "__DEGRADED_DOWNSTREAM_FAILURE__";

    @Override
    public AIClient create(Throwable cause) {
        return prompt -> {
            log.error("AI service downstream call failed: {}", cause != null ? cause.getMessage() : "unknown", cause);
            return SENTINEL_FALLBACK;
        };
    }
}
