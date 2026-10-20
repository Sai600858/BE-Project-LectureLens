package com.lecturelens.common;

import com.lecturelens.security.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private String getCorrelationId() {
        String id = MDC.get(CorrelationIdFilter.MDC_KEY);
        return id != null ? id : "unknown";
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("error", "Validation failed");
        resp.put("details", errors);
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.BAD_REQUEST.value());

        return ResponseEntity.badRequest().body(resp);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        log.warn("[Security] Bad credentials attempt: correlationId={}", getCorrelationId());
        Map<String, Object> resp = new HashMap<>();
        resp.put("error", "Invalid email or password");
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.UNAUTHORIZED.value());

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(resp);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("[Security] Access denied: correlationId={}, message={}", getCorrelationId(), ex.getMessage());
        Map<String, Object> resp = new HashMap<>();
        String errorMsg;
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            if (ex.getMessage().contains("Access denied")) {
                errorMsg = ex.getMessage();
            } else {
                errorMsg = "Access denied: " + ex.getMessage();
            }
        } else {
            errorMsg = "Access denied: insufficient permissions to perform this operation";
        }
        resp.put("error", errorMsg);
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.FORBIDDEN.value());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(resp);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxSizeException(MaxUploadSizeExceededException ex) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("error", "File upload exceeds maximum permitted limit (50MB)");
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());

        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(resp);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("error", ex.getMessage());
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.NOT_FOUND.value());

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(resp);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("error", ex.getMessage());
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.BAD_REQUEST.value());

        return ResponseEntity.badRequest().body(resp);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex, HttpServletRequest request) {
        // Log stack trace internally with correlationId; do NOT return raw stack traces or internal paths to client
        log.error("[Internal Error] Request {} failed: correlationId={}, message={}",
                request.getRequestURI(), getCorrelationId(), ex.getMessage(), ex);

        Map<String, Object> resp = new HashMap<>();
        resp.put("error", "An internal error occurred. Please reference correlation ID: " + getCorrelationId());
        resp.put("correlationId", getCorrelationId());
        resp.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resp);
    }
}
