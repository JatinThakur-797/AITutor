package com.gateway.filter;

import com.gateway.config.RateLimitProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.web.server.ServerWebExchange;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

@Component
public class TokenBucketRateLimitFilter
        implements GlobalFilter, Ordered {

    private static final Logger log =
            LoggerFactory.getLogger(TokenBucketRateLimitFilter.class);

    private final ReactiveStringRedisTemplate redisTemplate;

    private final RedisScript<List> tokenBucketScript;

    private final RateLimitProperties properties;

    private final MeterRegistry meterRegistry;
    @Autowired
    public TokenBucketRateLimitFilter(
            ReactiveStringRedisTemplate redisTemplate,
            RedisScript<List> tokenBucketScript,
            RateLimitProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.redisTemplate = redisTemplate;
        this.tokenBucketScript = tokenBucketScript;
        this.properties = properties;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public int getOrder() {
        // Run after the route's AuthenticationFilter.
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            GatewayFilterChain chain
    ) {

        ServerHttpRequest request = exchange.getRequest();

        String path = request.getURI().getPath();

        // Skip rate limiting when disabled.
        if (!properties.isEnabled()) {
            return chain.filter(exchange);
        }

        // CORS preflight requests should not consume tokens.
        if ("OPTIONS".equalsIgnoreCase(
                request.getMethod().name()
        )) {
            return chain.filter(exchange);
        }

        // Skip configured paths.
        if (isExcludedPath(path)) {
            return chain.filter(exchange);
        }

        // Identify client.
        String userId = request.getHeaders()
                .getFirst("X-User-Id");

        String identity;

        if (userId != null && !userId.isBlank()) {
            identity = "user:" + userId;
        } else {
            identity = "ip:" + resolveClientIp(request);
        }

        String redisKey = properties.getKeyPrefix()
                + ":" + sha256(identity);

        // Redis arguments.
        List<String> keys = List.of(redisKey);

        Object[] args = {
                String.valueOf(properties.getCapacity()),
                String.valueOf(properties.getRefillTokensPerMs()),
                String.valueOf(properties.getRequestCost()),
                String.valueOf(properties.getEffectiveTtlMs())
        };

        // Execute the atomic Lua script.
        Mono<List> decisionMono = redisTemplate
                .execute(tokenBucketScript, keys, List.of(args))
                .next()
                .switchIfEmpty(
                        Mono.error(new IllegalStateException(
                                "Redis returned an empty rate-limit result"
                        ))
                );

        // Handle Redis errors separately from downstream errors.
        return decisionMono
                .map(Decision::success)
                .onErrorResume(error -> {
                    log.error("Rate limiter Redis operation failed", error);
                    return Mono.just(Decision.failure(error));
                })
                .flatMap(decision -> {

                    if (decision.error() != null) {

                        incrementMetric("error");

                        if (properties.isFailOpen()) {
                            return chain.filter(exchange);
                        }

                        return serviceUnavailable(exchange);
                    }

                    List<?> result = decision.result();

                    if (result.size() < 3) {
                        incrementMetric("error");
                        return serviceUnavailable(exchange);
                    }

                    long allowed =
                            ((Number) result.get(0)).longValue();

                    long remaining =
                            ((Number) result.get(1)).longValue();

                    long retryAfterMs =
                            ((Number) result.get(2)).longValue();

                    // Add rate limit response headers.
                    exchange.getResponse()
                            .getHeaders()
                            .set(
                                    "X-RateLimit-Limit",
                                    String.valueOf(
                                            properties.getCapacity()
                                    )
                            );

                    exchange.getResponse()
                            .getHeaders()
                            .set(
                                    "X-RateLimit-Remaining",
                                    String.valueOf(remaining)
                            );

                    if (allowed == 1) {

                        incrementMetric("allowed");

                        return chain.filter(exchange);
                    }

                    incrementMetric("rejected");

                    return tooManyRequests(
                            exchange,
                            retryAfterMs
                    );
                });
    }

    private boolean isExcludedPath(String path) {

        return properties.getExcludedPaths()
                .stream()
                .anyMatch(excluded ->
                        path.equals(excluded)
                                || path.startsWith(excluded + "/")
                );
    }

    private String resolveClientIp(ServerHttpRequest request) {

        InetSocketAddress address =
                request.getRemoteAddress();

        if (address == null || address.getAddress() == null) {
            return "unknown";
        }

        // Do not trust arbitrary X-Forwarded-For headers.
        // Use the socket address unless a trusted proxy
        // configuration is implemented.
        return address.getAddress().getHostAddress();
    }

    private String sha256(String value) {

        try {

            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    value.getBytes(StandardCharsets.UTF_8)
            );

            return HexFormat.of().formatHex(hash);

        } catch (Exception e) {

            throw new IllegalStateException(
                    "Unable to generate client hash",
                    e
            );
        }
    }

    private Mono<Void> tooManyRequests(
            ServerWebExchange exchange,
            long retryAfterMs
    ) {

        long retryAfterSeconds = Math.max(
                1,
                (retryAfterMs + 999) / 1000
        );

        var response = exchange.getResponse();

        response.setStatusCode(
                HttpStatus.TOO_MANY_REQUESTS
        );

        response.getHeaders().setContentType(
                MediaType.APPLICATION_JSON
        );

        response.getHeaders().set(
                "Retry-After",
                String.valueOf(retryAfterSeconds)
        );

        String body = """
                {
                    "status": 429,
                    "error": "Too Many Requests",
                    "message": "Rate limit exceeded. Please retry later.",
                    "retryAfterSeconds": %d
                }
                """.formatted(retryAfterSeconds);

        byte[] bytes = body.getBytes(
                StandardCharsets.UTF_8
        );

        var buffer = response.bufferFactory().wrap(bytes);

        return response.writeWith(Mono.just(buffer));
    }

    private Mono<Void> serviceUnavailable(
            ServerWebExchange exchange
    ) {

        var response = exchange.getResponse();

        response.setStatusCode(
                HttpStatus.SERVICE_UNAVAILABLE
        );

        response.getHeaders().setContentType(
                MediaType.APPLICATION_JSON
        );

        response.getHeaders().set(
                "Retry-After",
                "1"
        );

        String body = """
                {
                    "status": 503,
                    "error": "Service Unavailable",
                    "message": "Rate limiting service is temporarily unavailable."
                }
                """;

        byte[] bytes = body.getBytes(
                StandardCharsets.UTF_8
        );

        return response.writeWith(
                Mono.just(response.bufferFactory().wrap(bytes))
        );
    }

    private void incrementMetric(String outcome) {

        Counter.builder("gateway.rate_limit.requests")
                .tag("outcome", outcome)
                .register(meterRegistry)
                .increment();
    }

    private record Decision(
            List<?> result,
            Throwable error
    ) {

        static Decision success(List<?> result) {
            return new Decision(result, null);
        }

        static Decision failure(Throwable error) {
            return new Decision(null, error);
        }
    }
}