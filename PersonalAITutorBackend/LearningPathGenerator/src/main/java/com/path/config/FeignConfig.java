package com.path.config;

import feign.RequestInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignConfig {
    @Bean
    public RequestInterceptor requestInterceptor() {
        return requestTemplate -> {
            // We verify ourselves to the AI Service
            requestTemplate.header("X-Gateway-Secret", "Jatin@MicroserviceResult");
        };
    }
}