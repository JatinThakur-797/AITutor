package com.gateway.filter;


import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Predicate;

@Component
public class RouteValidator {
    public static final List<String> openApiEndpoints = List.of(
            "/api/auth/signup",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/logout",
            "/oauth2",
            "/login",
            "/health",
            "/eureka"
    );
    public static Predicate<ServerHttpRequest> isSecured =
            request -> openApiEndpoints.stream().noneMatch(
                    uri -> request.getURI().getPath().startsWith(uri)
            );
}
