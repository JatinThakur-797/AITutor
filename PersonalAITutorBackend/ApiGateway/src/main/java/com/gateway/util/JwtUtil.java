package com.gateway.util;

import io.jsonwebtoken.Jwts;

import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;


import java.nio.charset.StandardCharsets;
import java.security.Key;
@Component
public class JwtUtil {
    public static final String SECRET = "sajdflksaiewakfjsdklajflksacnasnfjksahsafsdakjfweiroi";
    public void validateToken(String token){
        Jwts.parserBuilder().setSigningKey(getSignKey()).build().parseClaimsJws(token);
    }

    public String extractUserId(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject(); // This returns the User ID we stored in User-Service
    }
    private Key getSignKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }
}
