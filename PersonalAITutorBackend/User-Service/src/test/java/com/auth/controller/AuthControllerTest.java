package com.auth.controller;

import com.auth.config.WebConfig;
import com.auth.interceptor.SecurityInterceptor;
import com.auth.security.JwtAuthenticationFilter;
import com.auth.security.SecurityConfig;
import com.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = AuthController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class, WebConfig.class, SecurityInterceptor.class}
        )
)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    @DisplayName("POST /api/auth/refresh without refresh cookie returns 401 Unauthorized, never NPE")
    void refreshWithoutCookie_returns401Unauthorized() throws Exception {
        when(authService.refreshToken(any(), any())).thenAnswer(invocation -> {
            HttpServletRequest req = invocation.getArgument(0);
            if (req.getCookies() == null || req.getCookies().length == 0) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token missing");
            }
            return null;
        });

        mockMvc.perform(post("/api/auth/refresh")
                        .header("X-Gateway-Secret", "Jatin@MicroserviceResult"))
                .andExpect(status().isUnauthorized());
    }
}
