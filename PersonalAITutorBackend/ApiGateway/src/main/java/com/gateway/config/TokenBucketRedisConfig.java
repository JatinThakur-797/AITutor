package com.gateway.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class TokenBucketRedisConfig {

    @Bean
    public ReactiveStringRedisTemplate reactiveStringRedisTemplate(
            ReactiveRedisConnectionFactory factory
    ) {
        return new ReactiveStringRedisTemplate(factory);
    }

    @Bean
    public RedisScript<List> tokenBucketScript() {

        String luaScript = """
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local cost = tonumber(ARGV[3])
            local ttl = tonumber(ARGV[4])

            -- Use Redis server time to avoid application clock differences.
            local time = redis.call('TIME')

            local now =
                (tonumber(time[1]) * 1000)
                + math.floor(tonumber(time[2]) / 1000)

            -- Retrieve bucket state.
            local values = redis.call(
                'HMGET',
                KEYS[1],
                'tokens',
                'last_refill_ms'
            )

            local tokens = tonumber(values[1])
            local last_refill = tonumber(values[2])

            -- New client starts with a full bucket.
            if tokens == nil then
                tokens = capacity
                last_refill = now
            else

                -- Calculate elapsed time.
                local elapsed = math.max(
                    0,
                    now - last_refill
                )

                -- Refill tokens.
                tokens = math.min(
                    capacity,
                    tokens + (elapsed * refill_rate)
                )

            end

            local allowed = 0

            -- Consume token.
            if tokens >= cost then
                tokens = tokens - cost
                allowed = 1
            end

            -- Calculate retry time.
            local retry_after_ms = 0

            if allowed == 0 then
                retry_after_ms = math.ceil(
                    (cost - tokens) / refill_rate
                )
            end

            -- Persist state.
            redis.call(
                'HSET',
                KEYS[1],
                'tokens',
                tokens,
                'last_refill_ms',
                now
            )

            -- Automatically remove inactive buckets.
            redis.call(
                'PEXPIRE',
                KEYS[1],
                ttl
            )

            return {
                allowed,
                math.floor(tokens + 0.000000001),
                retry_after_ms
            }
            """;

        return RedisScript.of(luaScript, List.class);
    }
}