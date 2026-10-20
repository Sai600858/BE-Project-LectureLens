package com.lecturelens.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.UUID;

@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);

    // Maximum permitted image size: 50 Megabytes
    public static final long MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
    public static final long MIN_IMAGE_SIZE_BYTES = 16;


    @Value("${lecturelens.storage.snapshot-dir:../server/data/snapshots}")
    private String configuredSnapshotDir;

    public static class StoredImage {
        private final String contentId;
        private final String imagePath;
        private final String imageHash;
        private final String cleanBase64;
        private final String format;
        private final long sizeBytes;

        public StoredImage(String contentId, String imagePath, String imageHash, String cleanBase64, String format, long sizeBytes) {
            this.contentId = contentId;
            this.imagePath = imagePath;
            this.imageHash = imageHash;
            this.cleanBase64 = cleanBase64;
            this.format = format;
            this.sizeBytes = sizeBytes;
        }

        public String getContentId() { return contentId; }
        public String getImagePath() { return imagePath; }
        public String getImageHash() { return imageHash; }
        public String getCleanBase64() { return cleanBase64; }
        public String getFormat() { return format; }
        public long getSizeBytes() { return sizeBytes; }
    }

    /**
     * Validates and safely stores a whiteboard or screen snapshot.
     */
    public StoredImage validateAndStore(String prefix, String imageBase64) {
        if (imageBase64 == null || imageBase64.trim().isEmpty()) {
            throw new IllegalArgumentException("Image content is required (imageBase64 cannot be empty)");
        }

        String raw = imageBase64.trim();
        // Extract clean base64 data identical to Node.js regex
        String cleanBase64 = raw.replaceFirst("^data:image/[a-zA-Z0-9+.-]+;base64,", "");

        // Approximate length check to prevent massive memory exhaustion
        if (cleanBase64.length() > (MAX_IMAGE_SIZE_BYTES * 4 / 3 + 1024)) {
            throw new IllegalArgumentException("Image exceeds maximum permitted size of 50MB");
        }

        byte[] decodedBytes;
        try {
            decodedBytes = Base64.getDecoder().decode(cleanBase64);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Malformed base64 image data: " + e.getMessage());
        }

        if (decodedBytes.length < MIN_IMAGE_SIZE_BYTES) {
            throw new IllegalArgumentException("Image file is too small or empty (< 100 bytes)");
        }
        if (decodedBytes.length > MAX_IMAGE_SIZE_BYTES) {
            throw new IllegalArgumentException("Image exceeds maximum permitted size of 50MB");
        }

        // Validate image format magic numbers
        String format = detectImageFormat(decodedBytes);
        if (format == null) {
            throw new IllegalArgumentException("Unsupported image format. Allowed formats: JPEG, PNG, WEBP, GIF");
        }

        // Compute SHA-256 image hash using cleanBase64 string to match Node.js sha256
        String imageHash = computeSha256(cleanBase64);

        // Generate safe unique server-side identifier
        String contentId = prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String extension = format.equalsIgnoreCase("jpeg") ? "jpg" : format.toLowerCase();
        String safeFilename = contentId + "_full." + extension;

        File storageDir = resolveStorageDirectory();
        File targetFile = new File(storageDir, safeFilename);

        try (FileOutputStream fos = new FileOutputStream(targetFile)) {
            fos.write(decodedBytes);
            fos.flush();
        } catch (IOException e) {
            log.error("[ImageStorage] Failed to write image to disk: {}", targetFile.getAbsolutePath(), e);
            throw new RuntimeException("Failed to persist image file: " + e.getMessage(), e);
        }

        String canonicalPath = targetFile.getAbsolutePath();
        log.info("[ImageStorage] Successfully saved {} frame '{}' ({} bytes, format: {}, hash: {})",
                prefix, contentId, decodedBytes.length, format, imageHash);

        return new StoredImage(contentId, canonicalPath, imageHash, cleanBase64, format, decodedBytes.length);
    }

    private String detectImageFormat(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return null;

        // JPEG: FF D8 FF
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "jpeg";
        }
        // PNG: 89 50 4E 47
        if ((bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50 && (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47) {
            return "png";
        }
        // GIF: 47 49 46
        if ((bytes[0] & 0xFF) == 0x47 && (bytes[1] & 0xFF) == 0x49 && (bytes[2] & 0xFF) == 0x46) {
            return "gif";
        }
        // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
        if (bytes.length >= 12 &&
            (bytes[0] & 0xFF) == 0x52 && (bytes[1] & 0xFF) == 0x49 && (bytes[2] & 0xFF) == 0x46 && (bytes[3] & 0xFF) == 0x46 &&
            (bytes[8] & 0xFF) == 0x57 && (bytes[9] & 0xFF) == 0x45 && (bytes[10] & 0xFF) == 0x42 && (bytes[11] & 0xFF) == 0x50) {
            return "webp";
        }

        return null;
    }

    public static String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private File resolveStorageDirectory() {
        File dir = new File(configuredSnapshotDir);
        if (!dir.isAbsolute()) {
            // Check relative to working directory or fallback to ./data/snapshots
            Path currentPath = Paths.get("").toAbsolutePath();
            File candidate = new File(currentPath.toFile(), configuredSnapshotDir);
            if (candidate.exists() || candidate.mkdirs()) {
                return candidate;
            }
        }
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }
}
