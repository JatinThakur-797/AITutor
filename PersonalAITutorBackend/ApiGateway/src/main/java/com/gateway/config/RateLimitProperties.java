package com.gateway.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Data
@ConfigurationProperties(prefix = "gateway.rate-limit")
public class RateLimitProperties {

    private boolean enabled = true;

    private int capacity = 10;

    private double refillTokens = 2.0;

    private Duration refillPeriod = Duration.ofSeconds(1);

    private int requestCost = 1;

    private Duration bucketTtl = Duration.ofMinutes(2);

    private boolean failOpen = false;

    private String keyPrefix = "aitutor:gateway:rate-limit";

    private List<String> excludedPaths = new ArrayList<>(
            List.of("/health", "/actuator/health", "/eureka")
    );

    @PostConstruct
    public void validate() {

        if (capacity <= 0) {
            throw new IllegalArgumentException(
                    "Bucket capacity must be positive"
            );
        }

        if (refillTokens <= 0 || refillPeriod.isZero()
                || refillPeriod.isNegative()) {
            throw new IllegalArgumentException(
                    "Refill configuration must be positive"
            );
        }

        if (requestCost <= 0 || requestCost > capacity) {
            throw new IllegalArgumentException(
                    "Request cost must be between 1 and capacity"
            );
        }

        if (bucketTtl.isZero() || bucketTtl.isNegative()) {
            throw new IllegalArgumentException(
                    "Bucket TTL must be positive"
            );
        }
    }

    public double getRefillTokensPerMs() {
        return refillTokens / refillPeriod.toMillis();
    }

    public long getEffectiveTtlMs() {

        long fullRefillTime = (long) Math.ceil(
                capacity / getRefillTokensPerMs()
        );

        return Math.max(
                bucketTtl.toMillis(),
                fullRefillTime * 2
        );
    }

}