package com.auth.security;

import com.auth.entities.User;
import com.auth.entities.UserSocialAccount;
import com.auth.repository.UserRepository;
import com.auth.repository.UserSocialRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final TokenService tokenService;
    private final UserRepository userRepository;
    private final UserSocialRepository userSocialRepository;
    private final String frontendBaseUrl;

    public OAuth2AuthenticationSuccessHandler(TokenService tokenService,
                                              UserRepository userRepository,
                                              UserSocialRepository userSocialRepository,
                                              @Value("${app.base-url}") String frontendBaseUrl) {

        this.tokenService = tokenService;
        this.userRepository = userRepository;
        this.userSocialRepository = userSocialRepository;
        this.frontendBaseUrl = frontendBaseUrl;
        setAlwaysUseDefaultTargetUrl(false);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication)
            throws IOException, ServletException {

        OAuth2User oauth = (OAuth2User) authentication.getPrincipal();
        Map<String, Object> attrs = oauth.getAttributes();

        String provider;
        String providerUserId;
        String email;
        String name;

        // Google
        if (attrs.containsKey("sub")) {
            provider = "google";
            providerUserId = (String) attrs.get("sub");
            email = (String) attrs.get("email");
            name = (String) attrs.getOrDefault("name", "Google User");

            // GitHub
        } else if (attrs.containsKey("id")) {
            provider = "github";
            providerUserId = attrs.get("id").toString();
            email = (String) attrs.get("email");
            name = (String) attrs.getOrDefault("name", attrs.get("login"));

        } else {
            // Fallback
            provider = "unknown";
            providerUserId = "unknown";
            email = "unknown@local";
            name = "Unknown User";
        }

        // Find or create user
        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            Optional<UserSocialAccount> social = userSocialRepository
                    .findByProviderAndProviderUserId(provider, providerUserId);

            if (social.isPresent()) {
                user = social.get().getUser();
            }
        }

        if (user == null) {
            user = new User();
            user.setEmail(email != null ? email : provider + "_" + providerUserId + "@noemail.local");
            user.setName(name);
            userRepository.save(user);

            UserSocialAccount social = new UserSocialAccount();
            social.setUser(user);
            social.setProvider(provider);
            social.setProviderUserId(providerUserId);
            social.setProviderEmail(email);
            userSocialRepository.save(social);
        }

        // Create tokens
        TokenService.TokenPair tokens = tokenService.createTokens(user);

        // Set secure refresh cookie
        Cookie cookie = new Cookie("refresh", tokens.refreshToken());
        cookie.setHttpOnly(true);
        cookie.setPath("/api/auth/refresh");
        cookie.setMaxAge(60 * 60 * 24 * 30);
        cookie.setSecure(false); // change to true in HTTPS
        response.addCookie(cookie);

        // Redirect to frontend success page
        String redirectUrl = frontendBaseUrl +
                "/auth/success?token=" + URLEncoder.encode(tokens.accessToken(), StandardCharsets.UTF_8) +
                "&email=" + URLEncoder.encode(user.getEmail(), StandardCharsets.UTF_8) +
                "&name=" + URLEncoder.encode(user.getName(), StandardCharsets.UTF_8);

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
