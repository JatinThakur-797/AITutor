package com.ai.controller;

import com.ai.service.AIService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private static final Logger log = LoggerFactory.getLogger(AIController.class);

    private final AIService aiService;

    public AIController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/generate")
    public String generate(@RequestBody String prompt) {
        String response = aiService.generateContent(prompt);
        log.info("AI generation completed. Prompt characters: {}, response characters: {}",
                prompt == null ? 0 : prompt.length(),
                response.length());
        return response;
    }
}
