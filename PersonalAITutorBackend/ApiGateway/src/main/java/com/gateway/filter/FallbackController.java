package com.gateway.filter;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    private ResponseEntity<Map<String, Object>> buildFallbackResponse(String service) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, "15")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "service", service,
                        "available", false,
                        "retryAfterSeconds", 15
                ));
    }

    @RequestMapping("/user")
    public ResponseEntity<Map<String, Object>> userFallback() {
        return buildFallbackResponse("user");
    }

    @RequestMapping("/auth")
    public ResponseEntity<Map<String, Object>> authFallback() {
        return buildFallbackResponse("auth");
    }

    @RequestMapping("/path")
    public ResponseEntity<Map<String, Object>> pathFallback() {
        return buildFallbackResponse("path");
    }
}
