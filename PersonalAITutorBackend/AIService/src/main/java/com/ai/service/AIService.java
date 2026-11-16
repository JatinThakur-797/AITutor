package com.ai.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class AIService {

    private final ChatClient chatClient;

    public AIService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    public String generateContent(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }

        // Do not retry here with an unbounded/duplicated call loop.
        // Let provider exceptions propagate to the API error handler and
        // the LearningPathGenerator Feign circuit-breaker/fallback.
        String response = chatClient
                .prompt()
                .user(prompt)
                .call()
                .content();

        if (response == null || response.isBlank()) {
            throw new IllegalStateException("AI provider returned an empty response");
        }

        return response;
    }
}
