package com.ai.controller;

import com.ai.service.AIService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
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

    @PostMapping(
            value = "/generate",
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public String generate(@RequestBody String prompt) {

        String response = aiService.generateContent(prompt);

        log.info(
                "AI generation completed. Prompt characters: {}, response characters: {}",
                prompt == null ? 0 : prompt.length(),
                response == null ? 0 : response.length()
        );
        log.info(
                "Lesson format: open={}, close={}, taskOpen={}, taskClose={}",
                response.contains("<LESSON>"),
                response.contains("</LESSON>"),
                response.contains("<TASK>"),
                response.contains("</TASK>")
        );
        return response;
    }

    @PostMapping(
            value = "/generate/json",
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public String generateJson(@RequestBody String prompt) {
        return aiService.generateJsonContent(prompt);
    }
}
