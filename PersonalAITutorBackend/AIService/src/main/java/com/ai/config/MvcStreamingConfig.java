package com.ai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class MvcStreamingConfig implements WebMvcConfigurer {

    @Bean
    public AsyncTaskExecutor mvcStreamingTaskExecutor() {

        ThreadPoolTaskExecutor executor =
                new ThreadPoolTaskExecutor();

        executor.setCorePoolSize(8);

        executor.setMaxPoolSize(32);

        executor.setQueueCapacity(200);

        executor.setThreadNamePrefix("ai-stream-");

        executor.setWaitForTasksToCompleteOnShutdown(true);

        executor.setAwaitTerminationSeconds(10);

        executor.initialize();

        return executor;
    }

    @Override
    public void configureAsyncSupport(
            AsyncSupportConfigurer configurer) {

        configurer.setTaskExecutor(
                mvcStreamingTaskExecutor()
        );

        configurer.setDefaultTimeout(180_000L);
    }
}