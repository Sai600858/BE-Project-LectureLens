package com.lecturelens.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Component
public class ServiceAuthToken {

    private static final Logger log = LoggerFactory.getLogger(ServiceAuthToken.class);

    public static final String HEADER_SERVICE_IDENTITY = "X-Service-Identity";
    public static final String HEADER_SERVICE_TIMESTAMP = "X-Service-Timestamp";
    public static final String HEADER_SERVICE_SIGNATURE = "X-Service-Signature";

    private static final long MAX_SKEW_MS = 60_000; // 60 seconds tolerance to prevent replay attacks

    @Value("${lecturelens.service.secret:InternalLectureLensServiceCommunicationSecretKey2026}")
    private String serviceSecret;

    /**
     * Generate an inter-service signature for outgoing calls.
     */
    public String generateSignature(String serviceName, long timestamp) {
        try {
            String payload = serviceName + ":" + timestamp;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(serviceSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            log.error("Failed to generate service signature: {}", e.getMessage());
            throw new IllegalStateException("Service signature generation error", e);
        }
    }

    /**
     * Verify an incoming inter-service signature.
     */
    public boolean verifySignature(String serviceName, String timestampStr, String signature) {
        if (serviceName == null || timestampStr == null || signature == null) {
            return false;
        }

        try {
            long timestamp = Long.parseLong(timestampStr);
            long now = System.currentTimeMillis();

            // Replay attack prevention: check timestamp drift
            if (Math.abs(now - timestamp) > MAX_SKEW_MS) {
                log.warn("Rejected inter-service request from {} due to timestamp drift: skew={}ms", serviceName, (now - timestamp));
                return false;
            }

            String expectedSignature = generateSignature(serviceName, timestamp);
            // Constant-time comparison to prevent timing attacks
            return MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (NumberFormatException e) {
            log.warn("Invalid timestamp in service auth header: {}", timestampStr);
            return false;
        } catch (Exception e) {
            log.error("Error verifying inter-service signature: {}", e.getMessage());
            return false;
        }
    }
}
