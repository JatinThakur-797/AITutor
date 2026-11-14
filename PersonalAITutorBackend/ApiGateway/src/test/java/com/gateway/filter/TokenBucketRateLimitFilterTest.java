package com.gateway.filter;

import com.gateway.config.RateLimitProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class TokenBucketRateLimitFilterTest {

    private AtomicReference<Flux<List>> scriptResultRef;
    private AtomicBoolean scriptExecuted;
    private ReactiveStringRedisTemplate redisTemplate;
    private RedisScript<List> tokenBucketScript;
    private RateLimitProperties properties;
    private SimpleMeterRegistry meterRegistry;
    private TokenBucketRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        scriptResultRef = new AtomicReference<>(Flux.empty());
        scriptExecuted = new AtomicBoolean(false);

        ReactiveRedisConnectionFactory dummyFactory = (ReactiveRedisConnectionFactory) Proxy.newProxyInstance(
                ReactiveRedisConnectionFactory.class.getClassLoader(),
                new Class<?>[]{ReactiveRedisConnectionFactory.class},
                (proxy, method, args) -> null
        );

        redisTemplate = new ReactiveStringRedisTemplate(dummyFactory) {
            @Override
            @SuppressWarnings("unchecked")
            public <T> Flux<T> execute(RedisScript<T> script, List<String> keys, List<?> args) {
                scriptExecuted.set(true);
                return (Flux<T>) scriptResultRef.get();
            }
        };

        tokenBucketScript = RedisScript.of("return {1, 9, 0}", List.class);
        properties = new RateLimitProperties();
        properties.validate();
        meterRegistry = new SimpleMeterRegistry();
        filter = new TokenBucketRateLimitFilter(redisTemplate, tokenBucketScript, properties, meterRegistry);
    }

    @Test
    @DisplayName("Allows requests under capacity (allowed == 1)")
    void allowsRequestsUnderCapacity() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/path/test")
                .header("X-User-Id", "user-123")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        scriptResultRef.set(Flux.just(List.of(1L, 9L, 0L)));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertTrue(chainCalled.get(), "Chain filter should have been invoked");
        assertEquals("10", exchange.getResponse().getHeaders().getFirst("X-RateLimit-Limit"));
        assertEquals("9", exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining"));
    }

    @Test
    @DisplayName("Returns 429 when over capacity (allowed == 0) and sets Retry-After header")
    void returns429WhenOverCapacity() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/path/test")
                .remoteAddress(new java.net.InetSocketAddress("127.0.0.1", 8080))
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        scriptResultRef.set(Flux.just(List.of(0L, 0L, 5000L)));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertFalse(chainCalled.get(), "Chain filter should NOT have been invoked on rate limit rejection");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, exchange.getResponse().getStatusCode());
        assertEquals("5", exchange.getResponse().getHeaders().getFirst("Retry-After"));
    }

    @Test
    @DisplayName("Honors failOpen=true (passes request on Redis error)")
    void honorsFailOpenTrue() {
        properties.setFailOpen(true);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/path/test").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        scriptResultRef.set(Flux.error(new RuntimeException("Redis connection refused")));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertTrue(chainCalled.get(), "Chain filter should have been invoked when failOpen is true");
    }

    @Test
    @DisplayName("Honors failOpen=false (returns 503 on Redis error)")
    void honorsFailOpenFalse() {
        properties.setFailOpen(false);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/path/test").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        scriptResultRef.set(Flux.error(new RuntimeException("Redis connection refused")));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertFalse(chainCalled.get(), "Chain filter should NOT have been invoked on Redis error when failOpen is false");
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exchange.getResponse().getStatusCode());
    }

    @Test
    @DisplayName("Skips OPTIONS preflight requests")
    void skipsOptionsPreflight() {
        MockServerHttpRequest request = MockServerHttpRequest.method(HttpMethod.OPTIONS, "/api/path/test").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertTrue(chainCalled.get(), "Chain should be called for OPTIONS preflight");
        assertFalse(scriptExecuted.get(), "Redis script should not be executed for OPTIONS");
    }

    @Test
    @DisplayName("Skips excluded paths such as /health and /eureka")
    void skipsExcludedPaths() {
        MockServerHttpRequest healthRequest = MockServerHttpRequest.get("/health").build();
        MockServerWebExchange exchangeHealth = MockServerWebExchange.from(healthRequest);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchangeHealth, chain))
                .verifyComplete();

        assertTrue(chainCalled.get());
        assertFalse(scriptExecuted.get(), "Redis script should not be executed for /health");

        MockServerHttpRequest eurekaRequest = MockServerHttpRequest.get("/eureka/apps").build();
        MockServerWebExchange exchangeEureka = MockServerWebExchange.from(eurekaRequest);

        chainCalled.set(false);
        StepVerifier.create(filter.filter(exchangeEureka, chain))
                .verifyComplete();

        assertTrue(chainCalled.get());
        assertFalse(scriptExecuted.get(), "Redis script should not be executed for /eureka");
    }
}
