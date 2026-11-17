package com.ai.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.ResponseFormat;
import org.springframework.stereotype.Service;

@Service
public class AIService {

    private static final String JSON_SYSTEM_INSTRUCTION =
            "You are a structured data generator. Respond strictly with a valid JSON object. " +
                    "Do not include markdown formatting, code fences, or explanatory text outside the JSON.";

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

    public String generateJsonContent(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }

        OpenAiChatOptions options = OpenAiChatOptions.builder()
                .responseFormat(
                        ResponseFormat.builder()
                                .type(ResponseFormat.Type.JSON_OBJECT)
                                .build()
                )
                .maxTokens(4096)
                .build();

        String response = chatClient
                .prompt()
                .system(JSON_SYSTEM_INSTRUCTION)
                .user(prompt)
                .options(options)
                .call()
                .content();

        if (response == null || response.isBlank()) {
            throw new IllegalStateException("AI provider returned an empty JSON response");
        }

        return response;
    }
}