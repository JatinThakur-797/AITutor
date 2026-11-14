package com.gateway.filter;

import com.gateway.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

@Component
public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {
    private static final Logger log = LoggerFactory.getLogger(AuthenticationFilter.class);


    private final JwtUtil jwtUtil;

    @Value("${app.gateway.secret}")
    private String gatewaySecret;

    public AuthenticationFilter(JwtUtil jwtUtil) {
        super(Config.class);
        this.jwtUtil = jwtUtil;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            log.debug("{} {}", request.getMethod(), request.getPath());

            // 1. FIX: Ignore CORS Preflight requests
            if (request.getMethod().equals(HttpMethod.OPTIONS)) {
                return chain.filter(exchange);
            }

            // 2. FIX: Prevent Header Spoofing by clearing incoming sensitive headers
            ServerHttpRequest.Builder mutator = request.mutate()
                    .headers(headers -> {
                        headers.remove("X-Gateway-Secret");
                        headers.remove("X-User-Id");
                    })
                    .header("X-Gateway-Secret", gatewaySecret);

            // 3. Route Security Validation
            if (RouteValidator.isSecured.test(request)) {

                if (!request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    authHeader = authHeader.substring(7);
                }

                try {
                    jwtUtil.validateToken(authHeader);
                    String userId = jwtUtil.extractUserId(authHeader);

                    // Safely add the verified User ID
                    mutator.header("X-User-Id", userId);

                } catch (Exception e) {
                    log.error("JWT Validation Failed: {}", e.getMessage());
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }
            }

            return chain.filter(exchange.mutate().request(mutator.build()).build());
        };
    }

    public static class Config {
    }
}