package com.gateway.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RateLimitPropertiesTest {

    @Test
    @DisplayName("Default properties pass validation")
    void defaultProperties_passValidation() {
        RateLimitProperties props = new RateLimitProperties();
        assertDoesNotThrow(props::validate);
    }

    @Test
    @DisplayName("Rejects capacity <= 0")
    void rejectsZeroOrNegativeCapacity() {
        RateLimitProperties props = new RateLimitProperties();
        props.setCapacity(0);
        assertThrows(IllegalArgumentException.class, props::validate);

        props.setCapacity(-5);
        assertThrows(IllegalArgumentException.class, props::validate);
    }

    @Test
    @DisplayName("Rejects refillTokens <= 0")
    void rejectsZeroOrNegativeRefillTokens() {
        RateLimitProperties props = new RateLimitProperties();
        props.setRefillTokens(0);
        assertThrows(IllegalArgumentException.class, props::validate);

        props.setRefillTokens(-1.0);
        assertThrows(IllegalArgumentException.class, props::validate);
    }

    @Test
    @DisplayName("Rejects zero or negative refill period")
    void rejectsZeroOrNegativeRefillPeriod() {
        RateLimitProperties props = new RateLimitProperties();
        props.setRefillPeriod(Duration.ZERO);
        assertThrows(IllegalArgumentException.class, props::validate);

        props.setRefillPeriod(Duration.ofSeconds(-1));
        assertThrows(IllegalArgumentException.class, props::validate);
    }

    @Test
    @DisplayName("Rejects requestCost > capacity")
    void rejectsCostGreaterThanCapacity() {
        RateLimitProperties props = new RateLimitProperties();
        props.setCapacity(10);
        props.setRequestCost(15);
        assertThrows(IllegalArgumentException.class, props::validate);
    }

    @Test
    @DisplayName("Rejects requestCost <= 0")
    void rejectsZeroOrNegativeRequestCost() {
        RateLimitProperties props = new RateLimitProperties();
        props.setRequestCost(0);
        assertThrows(IllegalArgumentException.class, props::validate);

        props.setRequestCost(-2);
        assertThrows(IllegalArgumentException.class, props::validate);
    }

    @Test
    @DisplayName("Rejects zero or negative bucket TTL")
    void rejectsZeroOrNegativeBucketTtl() {
        RateLimitProperties props = new RateLimitProperties();
        props.setBucketTtl(Duration.ZERO);
        assertThrows(IllegalArgumentException.class, props::validate);

        props.setBucketTtl(Duration.ofMinutes(-1));
        assertThrows(IllegalArgumentException.class, props::validate);
    }
}
