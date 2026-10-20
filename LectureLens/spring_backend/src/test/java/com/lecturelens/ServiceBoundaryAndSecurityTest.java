package com.lecturelens;

import com.lecturelens.common.ApiResponse;
import com.lecturelens.common.GlobalExceptionHandler;
import com.lecturelens.security.CorrelationIdFilter;
import com.lecturelens.security.JwtUtils;
import com.lecturelens.security.ServiceAuthToken;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class ServiceBoundaryAndSecurityTest {

    @Autowired
    private ServiceAuthToken serviceAuthToken;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private CorrelationIdFilter correlationIdFilter;

    @Autowired
    private GlobalExceptionHandler globalExceptionHandler;

    @Test
    @DisplayName("Service-to-service HMAC signature generation and verification succeeds for valid calls")
    public void testValidServiceAuthToken() {
        String serviceName = "service-media-node";
        long now = System.currentTimeMillis();

        String signature = serviceAuthToken.generateSignature(serviceName, now);
        assertNotNull(signature);
        assertFalse(signature.isBlank());

        boolean isValid = serviceAuthToken.verifySignature(serviceName, String.valueOf(now), signature);
        assertTrue(isValid, "Legitimate inter-service signature must verify successfully");
    }

    @Test
    @DisplayName("Service-to-service signature rejects tampered service identity or signature")
    public void testTamperedServiceAuthToken() {
        long now = System.currentTimeMillis();
        String signature = serviceAuthToken.generateSignature("service-lecture", now);

        // Tamper service name
        boolean invalidService = serviceAuthToken.verifySignature("service-attacker", String.valueOf(now), signature);
        assertFalse(invalidService, "Tampered service name must be rejected");

        // Tamper signature string
        boolean invalidSignature = serviceAuthToken.verifySignature("service-lecture", String.valueOf(now), signature + "_bad");
        assertFalse(invalidSignature, "Corrupted signature must be rejected");
    }

    @Test
    @DisplayName("Service-to-service signature rejects expired / replayed timestamps (> 60s skew)")
    public void testReplayAttackTimestampDrift() {
        String serviceName = "service-ai";
        long oldTimestamp = System.currentTimeMillis() - 120_000; // 2 minutes ago

        String signature = serviceAuthToken.generateSignature(serviceName, oldTimestamp);
        boolean isAccepted = serviceAuthToken.verifySignature(serviceName, String.valueOf(oldTimestamp), signature);

        assertFalse(isAccepted, "Timestamp drift > 60s must be rejected to prevent replay attacks");
    }

    @Test
    @DisplayName("CorrelationIdFilter generates UUID and attaches to MDC and Response header")
    public void testCorrelationIdFilterGeneration() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/lectures");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        correlationIdFilter.doFilter(request, response, chain);

        String correlationHeader = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertNotNull(correlationHeader, "Response must include X-Correlation-Id header");
        assertFalse(correlationHeader.isBlank());
    }

    @Test
    @DisplayName("CorrelationIdFilter sanitizes untrusted input to prevent CRLF injection")
    public void testCorrelationIdSanitization() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/lectures");
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, "valid-id\r\nInjected-Header: evil<script>");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        correlationIdFilter.doFilter(request, response, chain);

        String correlationHeader = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertNotNull(correlationHeader);
        assertFalse(correlationHeader.contains("\r"));
        assertFalse(correlationHeader.contains("\n"));
        assertFalse(correlationHeader.contains("<script>"));
    }

    @Test
    @DisplayName("GlobalExceptionHandler returns sanitized error without exposing raw stack traces")
    public void testGlobalExceptionHandlerSanitization() {
        MDC.put(CorrelationIdFilter.MDC_KEY, "test-corr-1234");
        try {
            // Test BadCredentials
            ResponseEntity<Map<String, Object>> badCreds = globalExceptionHandler.handleBadCredentials(new BadCredentialsException("Internal auth fail"));
            assertEquals(HttpStatus.UNAUTHORIZED, badCreds.getStatusCode());
            assertEquals("Invalid email or password", badCreds.getBody().get("error"));
            assertEquals("test-corr-1234", badCreds.getBody().get("correlationId"));

            // Test AccessDenied
            ResponseEntity<Map<String, Object>> accessDenied = globalExceptionHandler.handleAccessDenied(new AccessDeniedException("Forbidden"));
            assertEquals(HttpStatus.FORBIDDEN, accessDenied.getStatusCode());
            assertTrue(accessDenied.getBody().get("error").toString().contains("Access denied"));

            // Test MaxUploadSizeExceeded
            ResponseEntity<Map<String, Object>> maxUpload = globalExceptionHandler.handleMaxSizeException(new MaxUploadSizeExceededException(52428800));
            assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, maxUpload.getStatusCode());
            assertTrue(maxUpload.getBody().get("error").toString().contains("50MB"));

            // Test General Exception
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/sensitive");
            ResponseEntity<Map<String, Object>> general = globalExceptionHandler.handleGeneralException(new RuntimeException("Database connection timeout at line 42"), req);
            assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, general.getStatusCode());
            assertFalse(general.getBody().get("error").toString().contains("Database connection timeout"), "Must not leak internal database errors or line numbers");
            assertTrue(general.getBody().get("error").toString().contains("test-corr-1234"));
        } finally {
            MDC.remove(CorrelationIdFilter.MDC_KEY);
        }
    }

    @Test
    @DisplayName("JwtUtils generates and validates signature, claims, and role correctly")
    public void testJwtGenerationAndValidation() {
        String token = jwtUtils.generateToken("usr_test_1", "teacher@lecturelens.edu", "TEACHER");
        assertNotNull(token);
        assertTrue(jwtUtils.validateToken(token));

        assertEquals("usr_test_1", jwtUtils.getUserIdFromToken(token));
        assertEquals("teacher@lecturelens.edu", jwtUtils.getEmailFromToken(token));
        assertEquals("TEACHER", jwtUtils.getRoleFromToken(token));
    }
}
