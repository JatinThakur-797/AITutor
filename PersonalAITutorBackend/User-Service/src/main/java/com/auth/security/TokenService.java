package com.auth.security;

import com.auth.entities.RefreshToken;
import com.auth.entities.User;
import com.auth.repository.RefreshTokenRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.keygen.KeyGenerators;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
public class TokenService {

    private static final String REFRESH_COOKIE_NAME = "refresh";
    private static final String REFRESH_COOKIE_PATH = "/api/auth";

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTokenValiditySeconds;
    private final boolean refreshCookieSecure;
    private final String refreshCookieSameSite;

    public TokenService(
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRepository refreshTokenRepository,
            @Value("${app.jwt.refresh-token-validity-seconds}") long refreshTokenValiditySeconds,
            @Value("${app.auth.refresh-cookie.secure:false}") boolean refreshCookieSecure,
            @Value("${app.auth.refresh-cookie.same-site:Lax}") String refreshCookieSameSite) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenValiditySeconds = refreshTokenValiditySeconds;
        this.refreshCookieSecure = refreshCookieSecure;
        this.refreshCookieSameSite = refreshCookieSameSite;
    }

    public record TokenPair(String accessToken, String refreshToken) {}

    public TokenPair createTokens(User user) {
        String access = jwtTokenProvider.createAccessToken(user.getId().toString());
        String plainRefresh = generateSecureToken();

        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(hashToken(plainRefresh));
        rt.setIssuedAt(OffsetDateTime.now());
        rt.setExpiresAt(OffsetDateTime.now().plusSeconds(refreshTokenValiditySeconds));
        refreshTokenRepository.save(rt);

        return new TokenPair(access, plainRefresh);
    }

    @Transactional
    public Optional<TokenPair> refresh(String providedRefreshToken) {
        if (providedRefreshToken == null || providedRefreshToken.isBlank()) {
            return Optional.empty();
        }

        Optional<RefreshToken> found =
                refreshTokenRepository.findByTokenHash(hashToken(providedRefreshToken));

        if (found.isEmpty()) {
            return Optional.empty();
        }

        RefreshToken existing = found.get();
        if (existing.isRevoked() || existing.getExpiresAt().isBefore(OffsetDateTime.now())) {
            return Optional.empty();
        }

        // Rotate the refresh token: revoke the old token and persist only the new hash.
        existing.setRevoked(true);
        refreshTokenRepository.save(existing);

        String newPlain = generateSecureToken();
        RefreshToken newRt = new RefreshToken();
        newRt.setUser(existing.getUser());
        newRt.setTokenHash(hashToken(newPlain));
        newRt.setIssuedAt(OffsetDateTime.now());
        newRt.setExpiresAt(OffsetDateTime.now().plusSeconds(refreshTokenValiditySeconds));
        refreshTokenRepository.save(newRt);

        String newAccess = jwtTokenProvider.createAccessToken(existing.getUser().getId().toString());
        return Optional.of(new TokenPair(newAccess, newPlain));
    }

    @Transactional
    public void revokeByToken(String providedRefreshToken) {
        if (providedRefreshToken == null || providedRefreshToken.isBlank()) {
            return;
        }

        refreshTokenRepository.findByTokenHash(hashToken(providedRefreshToken)).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
    }

    private String generateSecureToken() {
        byte[] bytes = KeyGenerators.secureRandom(32).generateKey();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash refresh token", e);
        }
    }

    public void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        Cookie cookie = buildRefreshCookie(refreshToken, (int) refreshTokenValiditySeconds);
        response.addCookie(cookie);
    }

    public void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = buildRefreshCookie("", 0);
        response.addCookie(cookie);
    }

    private Cookie buildRefreshCookie(String value, int maxAge) {
        Cookie cookie = new Cookie(REFRESH_COOKIE_NAME, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(refreshCookieSecure);
        cookie.setPath(REFRESH_COOKIE_PATH);
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", refreshCookieSameSite);
        return cookie;
    }

    public String readRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
