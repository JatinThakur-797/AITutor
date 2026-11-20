package com.ai.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.ResponseFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import reactor.core.publisher.Flux;

@Service
public class AIService {

    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    private static final String JSON_SYSTEM_INSTRUCTION =
            "You are a structured data generator. Respond strictly with a valid JSON object. " +
                    "Do not include markdown formatting, code fences, or explanatory text outside the JSON.";

    private final ChatClient chatClient;

    @Value("${ai.groq.primary-model:llama-3.3-70b-versatile}")
    private String primaryModel;

    @Value("${ai.groq.fallback-models:llama-3.1-8b-instant}")
    private String fallbackModelsRaw;

    private List<String> modelChain = List.of();

    public AIService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @PostConstruct
    public void initModelChain() {
        Set<String> orderedModels = new LinkedHashSet<>();
        if (primaryModel != null && !primaryModel.isBlank()) {
            orderedModels.add(primaryModel.trim());
        }
        if (fallbackModelsRaw != null && !fallbackModelsRaw.isBlank()) {
            Arrays.stream(fallbackModelsRaw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .forEach(orderedModels::add);
        }
        this.modelChain = new ArrayList<>(orderedModels);
        log.info("Configured Groq model fallback chain from properties/.env: {}", this.modelChain);
    }

    public String generateContent(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }

        RuntimeException lastException = null;

        for (String model : modelChain) {
            try {
                OpenAiChatOptions options = OpenAiChatOptions.builder()
                        .model(model)
                        .maxTokens(4096)
                        .build();

                String response = chatClient
                        .prompt()
                        .user(prompt)
                        .options(options)
                        .call()
                        .content();

                if (response != null && !response.isBlank()) {
                    return response;
                }
            } catch (Exception ex) {
                lastException = new RuntimeException("Model " + model + " failed: " + ex.getMessage(), ex);
                if (isNonRetryableAuthError(ex)) {
                    throw lastException;
                }
                log.warn("Groq model [{}] failed during generateContent ({}). Swapping to next model...", model, ex.getMessage());
            }
        }

        throw lastException != null
                ? lastException
                : new IllegalStateException("All AI models in fallback chain returned empty responses");
    }

    public Flux<String> streamContent(String prompt) {

        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }

        Flux<String> pipeline = Flux.error(new IllegalStateException("No models configured"));

        for (int i = 0; i < modelChain.size(); i++) {
            String model = modelChain.get(i);
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                    .model(model)
                    .maxTokens(2048)
                    .build();

            Flux<String> candidateStream = chatClient
                    .prompt()
                    .user(prompt)
                    .options(options)
                    .stream()
                    .content()
                    .filter(token -> token != null && !token.isEmpty());

            if (i == 0) {
                pipeline = candidateStream;
            } else {
                pipeline = pipeline.onErrorResume(err -> {
                    log.warn("Streaming failed on previous model ({}). Swapping to [{}]...", err.getMessage(), model);
                    return candidateStream;
                });
            }
        }

        return pipeline;
    }

    public String generateJsonContent(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }

        RuntimeException lastException = null;

        for (String model : modelChain) {
            // Attempt 1: Strict Groq JSON_OBJECT mode
            try {
                OpenAiChatOptions strictJsonOptions = OpenAiChatOptions.builder()
                        .model(model)
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
                        .options(strictJsonOptions)
                        .call()
                        .content();

                if (response != null && !response.isBlank()) {
                    return response;
                }
            } catch (Exception ex) {
                lastException = new RuntimeException("Model " + model + " JSON mode failed: " + ex.getMessage(), ex);
                if (isNonRetryableAuthError(ex)) {
                    throw lastException;
                }

                // Attempt 2: Retry same model without strict responseFormat if Groq threw 400 json_validate_failed
                if (isJsonValidationError(ex)) {
                    log.warn("Groq [{}] hit json_validate_failed. Retrying without strict responseFormat...", model);
                    try {
                        OpenAiChatOptions relaxedOptions = OpenAiChatOptions.builder()
                                .model(model)
                                .maxTokens(4096)
                                .build();

                        String fallbackResponse = chatClient
                                .prompt()
                                .system(JSON_SYSTEM_INSTRUCTION)
                                .user(prompt)
                                .options(relaxedOptions)
                                .call()
                                .content();

                        if (fallbackResponse != null && !fallbackResponse.isBlank()) {
                            return fallbackResponse;
                        }
                    } catch (Exception innerEx) {
                        log.warn("Relaxed JSON retry on [{}] also failed: {}", model, innerEx.getMessage());
                    }
                } else {
                    log.warn("Groq model [{}] failed during generateJsonContent ({}). Swapping to next model...", model, ex.getMessage());
                }
            }
        }

        throw lastException != null
                ? lastException
                : new IllegalStateException("All AI models failed to generate JSON content");
    }

    private boolean isNonRetryableAuthError(Exception ex) {
        String msg = ex.getMessage();
        return msg != null && (msg.contains("401") || msg.contains("invalid_api_key"));
    }

    private boolean isJsonValidationError(Exception ex) {
        String msg = ex.getMessage();
        return msg != null && (msg.contains("json_validate_failed") || msg.contains("400"));
    }
}