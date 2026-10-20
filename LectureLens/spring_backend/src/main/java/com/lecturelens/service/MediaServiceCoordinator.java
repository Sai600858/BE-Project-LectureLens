package com.lecturelens.service;

import com.lecturelens.security.CorrelationIdFilter;
import com.lecturelens.security.ServiceAuthToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Service
public class MediaServiceCoordinator {

    private static final Logger log = LoggerFactory.getLogger(MediaServiceCoordinator.class);

    @Value("${lecturelens.media-service.url:http://localhost:3001}")
    private String mediaServiceUrl;

    @Autowired
    private ServiceAuthToken serviceAuthToken;

    private final RestTemplate restTemplate;

    public MediaServiceCoordinator(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(2000))
                .setReadTimeout(Duration.ofMillis(2000))
                .build();
    }

    /**
     * Coordinate with the retained Node.js mediasoup service to pre-initialize room resources.
     */
    public boolean preInitializeRoom(String roomId, String lectureId) {
        if (roomId == null || roomId.isBlank()) {
            return false;
        }

        String targetUrl = mediaServiceUrl + "/internal/media/rooms/init";
        long timestamp = System.currentTimeMillis();
        String signature = serviceAuthToken.generateSignature("backend-spring", timestamp);
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null) correlationId = "spring-" + System.currentTimeMillis();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(ServiceAuthToken.HEADER_SERVICE_IDENTITY, "backend-spring");
        headers.set(ServiceAuthToken.HEADER_SERVICE_TIMESTAMP, String.valueOf(timestamp));
        headers.set(ServiceAuthToken.HEADER_SERVICE_SIGNATURE, signature);
        headers.set("X-Correlation-Id", correlationId);

        Map<String, String> payload = Map.of(
                "roomId", roomId,
                "lectureId", lectureId != null ? lectureId : ""
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(targetUrl, request, Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[MediaCoordination] Pre-initialized mediasoup room '{}' for lecture '{}'", roomId, lectureId);
                return true;
            }
        } catch (ResourceAccessException e) {
            log.warn("[MediaCoordination] Node.js media service unreachable at {}: {}", targetUrl, e.getMessage());
        } catch (RestClientResponseException e) {
            log.warn("[MediaCoordination] Node.js media service returned status {} for room '{}': {}",
                    e.getStatusCode(), roomId, e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("[MediaCoordination] Unexpected error coordinating with Node.js media service: {}", e.getMessage());
        }

        return false;
    }

    /**
     * Coordinate with the retained Node.js mediasoup service to close and cleanup a room.
     */
    public boolean closeRoom(String roomId, String lectureId) {
        if (roomId == null || roomId.isBlank()) {
            return false;
        }

        String targetUrl = mediaServiceUrl + "/internal/media/rooms/close";
        long timestamp = System.currentTimeMillis();
        String signature = serviceAuthToken.generateSignature("backend-spring", timestamp);
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null) correlationId = "spring-" + System.currentTimeMillis();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(ServiceAuthToken.HEADER_SERVICE_IDENTITY, "backend-spring");
        headers.set(ServiceAuthToken.HEADER_SERVICE_TIMESTAMP, String.valueOf(timestamp));
        headers.set(ServiceAuthToken.HEADER_SERVICE_SIGNATURE, signature);
        headers.set("X-Correlation-Id", correlationId);

        Map<String, String> payload = Map.of(
                "roomId", roomId,
                "lectureId", lectureId != null ? lectureId : ""
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(targetUrl, request, Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[MediaCoordination] Closed mediasoup room '{}' for lecture '{}'", roomId, lectureId);
                return true;
            }
        } catch (ResourceAccessException e) {
            log.warn("[MediaCoordination] Node.js media service unreachable for close: {}", e.getMessage());
        } catch (Exception e) {
            log.warn("[MediaCoordination] Unexpected error closing room in Node.js media service: {}", e.getMessage());
        }

        return false;
    }
}
