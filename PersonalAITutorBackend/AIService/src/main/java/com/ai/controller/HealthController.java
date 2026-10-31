package com.ai.controller;

import com.ai.service.AIService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/helloAI")
public class HealthController {
    private final AIService aiService;
    public HealthController(AIService aiService){
        this.aiService = aiService;
    }
    @GetMapping
    public String checkHealth(){
        String prompt = "Please Greet";
        String response = "";
        try{
            response = aiService.generateContent(prompt);
        }catch (Exception e){
            response = e.getMessage();
        }
        return response ;

    }
}
