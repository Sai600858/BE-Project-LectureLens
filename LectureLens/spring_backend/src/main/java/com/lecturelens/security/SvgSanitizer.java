package com.lecturelens.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class SvgSanitizer {

    private static final Logger log = LoggerFactory.getLogger(SvgSanitizer.class);

    // Forbidden tag patterns that could execute arbitrary script or embed untrusted frames
    private static final Pattern DANGEROUS_TAGS_PATTERN = Pattern.compile(
            "<(/?\\s*(script|foreignobject|iframe|embed|object|applet|meta|link|base|form|input))\\b[^>]*>",
            Pattern.CASE_INSENSITIVE
    );

    // Event handlers (e.g. onload, onerror, onclick, onmouseover)
    private static final Pattern EVENT_HANDLER_PATTERN = Pattern.compile(
            "\\s+on[a-zA-Z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)",
            Pattern.CASE_INSENSITIVE
    );

    // Javascript/data pseudo-protocols in href, xlink:href, src, etc.
    private static final Pattern JAVASCRIPT_URL_PATTERN = Pattern.compile(
            "(href|xlink:href|src|action)\\s*=\\s*(\"\\s*(javascript|data:text/html|vbscript):[^\"]*\"|'\\s*(javascript|data:text/html|vbscript):[^']*')",
            Pattern.CASE_INSENSITIVE
    );

    // CSS expressions or javascript: in style attributes
    private static final Pattern DANGEROUS_STYLE_PATTERN = Pattern.compile(
            "style\\s*=\\s*(\"[^\"]*(expression|javascript|behavior|@import)[^\"]*\"|'[^']*(expression|javascript|behavior|@import)[^']*')",
            Pattern.CASE_INSENSITIVE
    );

    /**
     * Checks if the SVG string contains potentially malicious payloads.
     */
    public boolean containsUnsafeContent(String svgContent) {
        if (svgContent == null || svgContent.isBlank()) {
            return false;
        }

        if (DANGEROUS_TAGS_PATTERN.matcher(svgContent).find()) {
            return true;
        }
        if (EVENT_HANDLER_PATTERN.matcher(svgContent).find()) {
            return true;
        }
        if (JAVASCRIPT_URL_PATTERN.matcher(svgContent).find()) {
            return true;
        }
        if (DANGEROUS_STYLE_PATTERN.matcher(svgContent).find()) {
            return true;
        }

        return false;
    }

    public static String sanitize(String svgContent) {
        return new SvgSanitizer().sanitizeSvg(svgContent);
    }

    /**
     * Sanitizes SVG content by stripping dangerous tags, event handlers, and script URLs
     * while preserving safe vector rendering elements (paths, coordinates, text, labels).
     */
    public String sanitizeSvg(String svgContent) {
        if (svgContent == null || svgContent.isBlank()) {
            return "";
        }

        String sanitized = svgContent;

        // Remove dangerous tags completely
        Matcher tagMatcher = DANGEROUS_TAGS_PATTERN.matcher(sanitized);
        if (tagMatcher.find()) {
            log.warn("[Security] Stripped unsafe tags from SVG output");
            sanitized = tagMatcher.replaceAll("");
        }

        // Remove event handlers
        Matcher eventMatcher = EVENT_HANDLER_PATTERN.matcher(sanitized);
        if (eventMatcher.find()) {
            log.warn("[Security] Stripped event handlers from SVG output");
            sanitized = eventMatcher.replaceAll("");
        }

        // Remove javascript: URLs
        Matcher urlMatcher = JAVASCRIPT_URL_PATTERN.matcher(sanitized);
        if (urlMatcher.find()) {
            log.warn("[Security] Stripped javascript: URL reference from SVG output");
            sanitized = urlMatcher.replaceAll("");
        }

        // Remove dangerous style expressions
        Matcher styleMatcher = DANGEROUS_STYLE_PATTERN.matcher(sanitized);
        if (styleMatcher.find()) {
            log.warn("[Security] Stripped dangerous style expression from SVG output");
            sanitized = styleMatcher.replaceAll("");
        }

        return sanitized.trim();
    }

    /**
     * Context-aware sanitization for study notes Markdown/HTML, preventing XSS injection
     * while preserving KaTeX formulas, math blocks, and markdown structure.
     */
    public String sanitizeMarkdown(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }

        String clean = markdown;
        // Strip <script> and dangerous tags from markdown
        clean = DANGEROUS_TAGS_PATTERN.matcher(clean).replaceAll("");
        clean = EVENT_HANDLER_PATTERN.matcher(clean).replaceAll("");
        clean = JAVASCRIPT_URL_PATTERN.matcher(clean).replaceAll("");

        return clean;
    }
}
