package com.ai.controller;

import com.ai.service.AIService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AIController {
    private final AIService aiService;
    public AIController(AIService aiService){
        this.aiService = aiService;
    }

    @PostMapping("/generate")
    public String generate(@RequestBody String prompt) {
        System.out.println("From AI Controller method ");
        String response = aiService.generateContent(prompt);
        System.out.println(response);
        return response;
    }



}
