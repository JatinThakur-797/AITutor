package com.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "app.internal.secret=test-secret",
        "spring.ai.openai.api-key=test-key",
        "spring.ai.openai.chat.options.model=test-model",
        "eureka.client.service-url.defaultZone=http://localhost:8761/eureka/"
})
class AiServiceApplicationTests {

    @Test
    void contextLoads() {
    }

}
