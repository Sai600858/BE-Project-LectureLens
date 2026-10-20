package com.lecturelens.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtils {

    @Value("${lecturelens.jwt.secret:lecturelens_secure_persistent_key_2026_super_secret}")
    private String jwtSecret;

    @Value("${lecturelens.jwt.expiration-ms:604800000}")
    private long jwtExpirationMs;

    private Key getSignKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String userId, String email, String name, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .setSubject(userId)
                .claim("id", userId)
                .claim("email", email)
                .claim("name", name != null ? name : "")
                .claim("role", role)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateToken(String userId, String email, String role) {
        return generateToken(userId, email, "", role);
    }

    public String generateExpiredToken(String userId, String email, String name, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() - 3600000); // Expired 1 hour ago

        return Jwts.builder()
                .setSubject(userId)
                .claim("id", userId)
                .claim("email", email)
                .claim("name", name != null ? name : "")
                .claim("role", role)
                .setIssuedAt(new Date(now.getTime() - 7200000))
                .setExpiration(expiryDate)
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims getAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String getUserIdFromToken(String token) {
        Claims claims = getAllClaims(token);
        String subject = claims.getSubject();
        if (subject != null && !subject.isBlank()) {
            return subject;
        }
        return claims.get("id", String.class);
    }

    public String getEmailFromToken(String token) {
        return getAllClaims(token).get("email", String.class);
    }

    public String getNameFromToken(String token) {
        return getAllClaims(token).get("name", String.class);
    }

    public String getRoleFromToken(String token) {
        return getAllClaims(token).get("role", String.class);
    }

    public boolean validateToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            Jwts.parserBuilder().setSigningKey(getSignKey()).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
