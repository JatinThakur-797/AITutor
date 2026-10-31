package com.auth.security;


import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenProvider {
    private final SecretKey key;
    private final String issuer;
    private final long accessTokenValiditySeconds;
    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-token-validity-seconds}") long accessTokenValiditySeconds) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.accessTokenValiditySeconds = accessTokenValiditySeconds;
    }
    public String createAccessToken(String userId){
        Instant now = Instant.now();
        String jti = UUID.randomUUID().toString();
        Date expiry = Date.from(now.plusSeconds(accessTokenValiditySeconds));
        return Jwts.builder()
                .setIssuer(issuer)
                .setSubject(userId)
                .setId(jti)
                .setIssuedAt(Date.from(now))
                .setExpiration(expiry)
                .signWith(key)
                .compact();
    }
    public Jws<Claims> parseToken(String token){
//        JwtParserBuilder j = Jwts.parserBuilder();
//        j.setSigningKey(key);
//        JwtParser p = j.build();
//         return p.parseClaimsJws(token);
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }

}
