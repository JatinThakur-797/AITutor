package com.path.service;

import com.path.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "AI-SERVICE", configuration = FeignConfig.class)
public interface AIClient {

    @PostMapping("/api/ai/generate")
    String generatePath(@RequestBody String prompt);
}