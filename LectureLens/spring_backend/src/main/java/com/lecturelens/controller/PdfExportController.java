package com.lecturelens.controller;

import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.service.PdfExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "PDF Export", description = "Structured academic PDF exports for transcripts, summaries, and study notes")
public class PdfExportController {

    @Autowired
    private PdfExportService pdfExportService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String userId = auth.getName();
            return userRepository.findById(userId).orElse(null);
        }
        return null;
    }

    @GetMapping("/{lectureId}/pdf/transcript")
    @Operation(summary = "Export transcript PDF", description = "Generates formatted multi-page PDF transcript with speaker attribution and timestamps")
    public ResponseEntity<byte[]> exportTranscriptPdf(@PathVariable String lectureId) throws IOException {
        User user = getCurrentUser();
        byte[] pdfBytes = pdfExportService.generateTranscriptPdf(lectureId, user);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lecture_" + lectureId + "_transcript.pdf\"")
                .body(pdfBytes);
    }

    @GetMapping("/{lectureId}/pdf/summary")
    @Operation(summary = "Export summary PDF", description = "Generates formatted executive summary PDF with key concepts, takeaways, and chapters")
    public ResponseEntity<byte[]> exportSummaryPdf(@PathVariable String lectureId) throws IOException {
        User user = getCurrentUser();
        byte[] pdfBytes = pdfExportService.generateSummaryPdf(lectureId, user);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lecture_" + lectureId + "_summary.pdf\"")
                .body(pdfBytes);
    }

    @GetMapping("/{lectureId}/pdf/study-notes")
    @Operation(summary = "Export study notes PDF", description = "Generates formatted structured study notes PDF with formulas and derivations")
    public ResponseEntity<byte[]> exportStudyNotesPdf(
            @PathVariable String lectureId,
            @RequestParam(required = false, defaultValue = "detailed") String mode) throws IOException {
        User user = getCurrentUser();
        byte[] pdfBytes = pdfExportService.generateStudyNotesPdf(lectureId, mode, user);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lecture_" + lectureId + "_study_notes_" + mode + ".pdf\"")
                .body(pdfBytes);
    }
}
