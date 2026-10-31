package com.gateway.filter;

import com.gateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
@Component

public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {
    @Autowired
    private JwtUtil jwtUtil;

    public AuthenticationFilter() {

        super(Config.class);

    }
    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            System.out.println(request.getMethod() + " " + request.getPath());
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
                    .header("X-Gateway-Secret", "Jatin@MicroserviceResult");

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
                    System.out.println("JWT Validation Failed: " + e.getMessage());
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