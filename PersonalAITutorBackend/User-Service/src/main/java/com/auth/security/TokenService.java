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

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTokenValiditySeconds;

    public TokenService(JwtTokenProvider jwtTokenProvider,
                        RefreshTokenRepository refreshTokenRepository,
                        @Value("${app.jwt.refresh-token-validity-seconds}") long refreshTokenValiditySeconds) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenValiditySeconds = refreshTokenValiditySeconds;
    }

    public record TokenPair(String accessToken, String refreshToken) {}

    public TokenPair createTokens(User user) {
        String access = jwtTokenProvider.createAccessToken(user.getId().toString());
        String plainRefresh = generateSecureToken();
        String hashed = hashToken(plainRefresh);

        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(hashed);
        rt.setIssuedAt(OffsetDateTime.now());
        rt.setExpiresAt(OffsetDateTime.now().plusSeconds(refreshTokenValiditySeconds));
        refreshTokenRepository.save(rt);
        return new TokenPair(access, plainRefresh);
    }

    @Transactional
    public Optional<TokenPair> refresh(String providedRefreshToken) {
        String hashed = hashToken(providedRefreshToken);
        Optional<RefreshToken> found = refreshTokenRepository.findByTokenHash(hashed);
        if (found.isEmpty()) return Optional.empty();
        RefreshToken existing = found.get();
        if (existing.isRevoked() || existing.getExpiresAt().isBefore(OffsetDateTime.now())) {
            return Optional.empty();
        }

        // rotate: revoke current, create new
        existing.setRevoked(true);
        refreshTokenRepository.save(existing);

        String newPlain = generateSecureToken();
        String newHashed = hashToken(newPlain);

        RefreshToken newRt = new RefreshToken();
        newRt.setUser(existing.getUser());
        newRt.setTokenHash(newHashed);
        newRt.setIssuedAt(OffsetDateTime.now());
        newRt.setExpiresAt(OffsetDateTime.now().plusSeconds(refreshTokenValiditySeconds));
        refreshTokenRepository.save(newRt);

        String newAccess = jwtTokenProvider.createAccessToken(existing.getUser().getId().toString());
        return Optional.of(new TokenPair(newAccess, newPlain));
    }

    @Transactional
    public void revokeByToken(String providedRefreshToken) {
        if (providedRefreshToken == null) return;
        String hashed = hashToken(providedRefreshToken);
        refreshTokenRepository.findByTokenHash(hashed).ifPresent(rt -> {
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
            throw new RuntimeException(e);
        }
    }

    // Cookie helper methods

    public void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        Cookie cookie = new Cookie("refresh", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setPath("/api/auth/refresh");
        cookie.setMaxAge((int) refreshTokenValiditySeconds);
        cookie.setSecure(false); // set true in production
        cookie.setHttpOnly(true);
        response.addCookie(cookie);
    }

    public void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("refresh", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/api/auth/refresh");
        cookie.setMaxAge(0);
        cookie.setSecure(false);
        response.addCookie(cookie);
    }

    public String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if ("refresh".equals(c.getName())){
                System.out.println(c.getValue());
                return c.getValue();
            }
        }
        return null;
    }
}
