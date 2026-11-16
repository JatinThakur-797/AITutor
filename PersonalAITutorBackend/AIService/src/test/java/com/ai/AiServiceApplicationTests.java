package com.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = "app.internal.secret=test-only-internal-secret")
@ActiveProfiles("test")
class AiServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
