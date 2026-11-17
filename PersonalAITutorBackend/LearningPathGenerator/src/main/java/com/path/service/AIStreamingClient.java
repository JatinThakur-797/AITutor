package com.path.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;

@Component
public class AIStreamingClient {

    private final WebClient webClient;
    private final String internalSecret;

    public AIStreamingClient(
            @LoadBalanced WebClient.Builder builder,
            @Value("${app.internal.secret}") String internalSecret) {

        this.webClient = builder.build();
        this.internalSecret = internalSecret;
    }

    public Flux<ServerSentEvent<String>> stream(String prompt) {

        if (prompt == null || prompt.isBlank()) {
            return Flux.error(
                    new IllegalArgumentException(
                            "Prompt cannot be empty"
                    )
            );
        }

        return webClient
                .post()

                .uri("http://AI-SERVICE/api/ai/stream")

                .contentType(MediaType.TEXT_PLAIN)

                .accept(MediaType.TEXT_EVENT_STREAM)

                // AI-Service validates this internal secret.
                .header(
                        "X-Gateway-Secret",
                        internalSecret
                )

                .bodyValue(prompt)

                .retrieve()

                .onStatus(
                        HttpStatusCode::isError,
                        response -> response
                                .bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .map(body ->
                                        new IllegalStateException(
                                                "AI-Service returned HTTP "
                                                        + response.statusCode().value()
                                        )
                                )
                )

                // Do not collectList() or block().
                // Consume SSE events as they arrive.
                .bodyToFlux(
                        new ParameterizedTypeReference<
                                ServerSentEvent<String>
                                >() {}
                );
    }
}