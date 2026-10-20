package com.lecturelens.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.dto.VisionAnalysisDto;
import com.lecturelens.security.CorrelationIdFilter;
import com.lecturelens.security.ServiceAuthToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class VisionWorkerClientImpl implements VisionWorkerClient {

    private static final Logger log = LoggerFactory.getLogger(VisionWorkerClientImpl.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${lecturelens.media-service.url:http://localhost:3001}")
    private String mediaServiceUrl;

    @Autowired
    private ServiceAuthToken serviceAuthToken;

    @Autowired
    private LocalVisionHeuristicAnalyzer localVisionHeuristicAnalyzer;

    private final RestTemplate restTemplate;

    public VisionWorkerClientImpl(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(3000))
                .setReadTimeout(Duration.ofMillis(3000))
                .build();
    }

    @Override
    public VisionAnalysisDto analyzeFrame(String frameType, String lectureId, String imageBase64, Double timestamp, String imagePath) {
        String targetUrl = mediaServiceUrl + "/internal/vision/analyze";
        long now = System.currentTimeMillis();
        String signature = serviceAuthToken.generateSignature("backend-spring", now);
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null) correlationId = "spring-" + System.currentTimeMillis();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(ServiceAuthToken.HEADER_SERVICE_IDENTITY, "backend-spring");
        headers.set(ServiceAuthToken.HEADER_SERVICE_TIMESTAMP, String.valueOf(now));
        headers.set(ServiceAuthToken.HEADER_SERVICE_SIGNATURE, signature);
        headers.set("X-Correlation-Id", correlationId);

        Map<String, Object> payload = new HashMap<>();
        payload.put("frameType", frameType);
        payload.put("lectureId", lectureId);
        payload.put("imageBase64", imageBase64);
        payload.put("timestamp", timestamp != null ? timestamp : 0.0);
        payload.put("imagePath", imagePath);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(targetUrl, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<?, ?> body = response.getBody();
                Object analysisObj = body.get("analysis") != null ? body.get("analysis") : body;
                VisionAnalysisDto dto = MAPPER.convertValue(analysisObj, VisionAnalysisDto.class);
                if (dto != null) {
                    if (dto.getQualityScore() == null || dto.getQualityScore() <= 0) {
                        dto.setQualityScore(localVisionHeuristicAnalyzer.calculateQualityScore(dto));
                    }
                    log.info("[VisionWorkerClient] Vision analysis succeeded from worker for lecture '{}' (qualityScore: {})",
                            lectureId, dto.getQualityScore());
                    return dto;
                }
            }
        } catch (ResourceAccessException e) {
            log.warn("[VisionWorkerClient] Node.js vision worker unreachable at {}: {}. Using local pedagogical fallback.",
                    targetUrl, e.getMessage());
        } catch (RestClientResponseException e) {
            log.warn("[VisionWorkerClient] Node.js vision worker returned status {}: {}. Using local pedagogical fallback.",
                    e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("[VisionWorkerClient] Unexpected error calling vision worker: {}. Using local pedagogical fallback.", e.getMessage());
        }

        // Graceful fallback to deterministic educational heuristic
        return localVisionHeuristicAnalyzer.analyzeHeuristic(frameType, timestamp, imagePath, null);
    }
}
