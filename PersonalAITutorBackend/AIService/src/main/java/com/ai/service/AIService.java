package com.ai.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

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
    private final ConcurrentHashMap<String, Long> modelRateLimitUntilMs = new ConcurrentHashMap<>();

    @Value("${ai.groq.primary-model:}")
    private String primaryModel;

    @Value("${ai.groq.fallback-models:}")
    private String fallbackModelsRaw;

    @Value("${ai.groq.rate-limit-cooldown-ms:20000}")
    private long rateLimitCooldownMs;

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
        this.modelChain = List.copyOf(new ArrayList<>(orderedModels));
        log.info("Configured Groq model rotation chain: {} (429 cooldown={}ms)", this.modelChain, this.rateLimitCooldownMs);
    }

    public String generateContent(String prompt) {
        validatePrompt(prompt);
        List<String> candidates = orderedCandidatesForCall();
        RuntimeException lastException = null;

        for (String model : candidates) {
            try {
                OpenAiChatOptions options = OpenAiChatOptions.builder()
                        .model(model)
                        .maxTokens(2048)
                        .build();

                String response = chatClient
                        .prompt()
                        .user(prompt)
                        .options(options)
                        .call()
                        .content();

                if (response != null && !response.isBlank()) {
                    modelRateLimitUntilMs.remove(model);
                    return response;
                }
            } catch (Exception ex) {
                lastException = new RuntimeException("Model " + model + " failed: " + ex.getMessage(), ex);
                if (isAuthError(ex)) {
                    log.warn("Stopping model rotation on [{}] due to authentication error: {}", model, ex.getMessage());
                    throw lastException;
                }
                if (isRateLimitError(ex)) {
                    markRateLimited(model);
                    log.warn("Groq free-tier limit hit on [{}]. Rotating to next model...", model);
                } else {
                    log.warn("Groq model [{}] failed ({}). Rotating to next model...", model, ex.getMessage());
                }
            }
        }

        throw lastException != null
                ? lastException
                : new IllegalStateException("All Groq models in chain returned empty responses");
    }

    public Flux<String> streamContent(String prompt) {
        validatePrompt(prompt);
        List<String> candidates = orderedCandidatesForCall();
        if (candidates.isEmpty()) {
            return Flux.error(new IllegalStateException("No AI models configured"));
        }

        AtomicReference<String> activeModel = new AtomicReference<>(candidates.get(0));
        Flux<String> pipeline = null;

        for (int i = 0; i < candidates.size(); i++) {
            final String model = candidates.get(i);
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                    .model(model)
                    .maxTokens(1024)
                    .build();

            Flux<String> candidateStream = chatClient
                    .prompt()
                    .user(prompt)
                    .options(options)
                    .stream()
                    .content()
                    .filter(token -> token != null && !token.isEmpty())
                    .doOnNext(token -> activeModel.set(model));

            if (i == 0) {
                pipeline = candidateStream;
            } else {
                pipeline = pipeline.onErrorResume(err -> {
                    if (isAuthError(err)) {
                        return Flux.error(err);
                    }
                    if (isRateLimitError(err)) {
                        markRateLimited(activeModel.get());
                        log.warn("Stream rate-limited on [{}]. Failing over to [{}]...", activeModel.get(), model);
                    } else {
                        log.warn("Stream failed on [{}] ({}). Failing over to [{}]...", activeModel.get(), err.getMessage(), model);
                    }
                    activeModel.set(model);
                    return candidateStream;
                });
            }
        }

        return pipeline.doOnError(err -> {
            if (isRateLimitError(err)) {
                markRateLimited(activeModel.get());
            }
        });
    }

    public String generateJsonContent(String prompt) {
        validatePrompt(prompt);
        List<String> candidates = orderedCandidatesForCall();
        RuntimeException lastException = null;

        for (String model : candidates) {
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
                    modelRateLimitUntilMs.remove(model);
                    return response;
                }
            } catch (Exception ex) {
                lastException = new RuntimeException("Model " + model + " JSON mode failed: " + ex.getMessage(), ex);

                if (isAuthError(ex)) {
                    log.warn("Stopping JSON model rotation on [{}] due to authentication error: {}", model, ex.getMessage());
                    throw lastException;
                }

                if (isRateLimitError(ex)) {
                    markRateLimited(model);
                    log.warn("Groq free-tier limit hit on [{}] during JSON generation. Rotating to next model...", model);
                    continue;
                }

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
                            modelRateLimitUntilMs.remove(model);
                            return fallbackResponse;
                        }
                        lastException = new RuntimeException("Relaxed JSON retry on " + model + " returned empty response", ex);
                    } catch (Exception innerEx) {
                        lastException = new RuntimeException("Relaxed JSON retry on " + model + " failed: " + innerEx.getMessage(), innerEx);
                        if (isRateLimitError(innerEx)) {
                            markRateLimited(model);
                        }
                        log.warn("Relaxed JSON retry on [{}] failed ({}). Rotating to next model...", model, innerEx.getMessage());
                    }
                } else {
                    log.warn("Groq model [{}] failed during generateJsonContent ({}). Rotating to next model...", model, ex.getMessage());
                }
            }
        }

        throw lastException != null
                ? lastException
                : new IllegalStateException("All Groq models failed to generate JSON content");
    }

    /**
     * Puts available (non-cooled) models first in configured priority order, followed by
     * cooled models so we still try them as a last resort if every model hit 429.
     */
    private List<String> orderedCandidatesForCall() {
        if (modelChain.isEmpty()) {
            throw new IllegalStateException("No AI models configured in primary-model or fallback-models");
        }
        long now = System.currentTimeMillis();
        List<String> available = new ArrayList<>();
        List<String> cooled = new ArrayList<>();

        for (String model : modelChain) {
            Long until = modelRateLimitUntilMs.get(model);
            if (until != null && until > now) {
                cooled.add(model);
            } else {
                modelRateLimitUntilMs.remove(model);
                available.add(model);
            }
        }

        List<String> ordered = new ArrayList<>(available.size() + cooled.size());
        ordered.addAll(available);
        ordered.addAll(cooled);
        return ordered;
    }

    private void markRateLimited(String model) {
        if (model != null && !model.isBlank()) {
            modelRateLimitUntilMs.put(model, System.currentTimeMillis() + Math.max(1000L, rateLimitCooldownMs));
        }
    }

    private void validatePrompt(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("AI prompt must not be empty");
        }
    }

    private boolean isAuthError(Throwable ex) {
        String msg = collectMessages(ex);
        return msg.contains("401") || msg.contains("invalid_api_key") || msg.contains("unauthorized");
    }

    private boolean isRateLimitError(Throwable ex) {
        String msg = collectMessages(ex);
        return msg.contains("429") || msg.contains("rate_limit") || msg.contains("too many requests");
    }

    private boolean isJsonValidationError(Throwable ex) {
        String msg = collectMessages(ex);
        return msg.contains("json_validate_failed");
    }

    private String collectMessages(Throwable ex) {
        StringBuilder sb = new StringBuilder();
        Throwable curr = ex;
        int depth = 0;
        while (curr != null && depth < 6) {
            if (curr.getMessage() != null) {
                sb.append(curr.getMessage().toLowerCase()).append(' ');
            }
            curr = curr.getCause();
            depth++;
        }
        return sb.toString();
    }
}