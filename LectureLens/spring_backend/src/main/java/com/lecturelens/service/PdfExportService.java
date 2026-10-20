package com.lecturelens.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.access.AccessDeniedException;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.*;
import com.lecturelens.model.*;
import com.lecturelens.repository.*;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class PdfExportService {

    private static final Logger log = LoggerFactory.getLogger(PdfExportService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private StudyNoteRepository studyNoteRepository;

    @Autowired
    private LectureChapterRepository chapterRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    private static final PDType1Font FONT_TITLE = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final PDType1Font FONT_HEADING = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final PDType1Font FONT_BODY = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font FONT_CODE = new PDType1Font(Standard14Fonts.FontName.COURIER);

    private Lecture resolveLectureAndCheckAccess(String lectureIdentifier, User currentUser) {
        if (lectureIdentifier == null || lectureIdentifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }
        String cleanId = lectureIdentifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUser == null) {
                throw new AccessDeniedException("Authentication required to download private lecture PDF.");
            }
            boolean isHost = currentUser.getId().equals(lecture.getHostId());
            boolean isAdmin = currentUser.getRole() == Role.ADMIN;
            boolean isEnrolled = participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUser.getId());
            if (!isHost && !isAdmin && !isEnrolled) {
                throw new AccessDeniedException("Access denied: You are not authorized to download this PDF.");
            }
        }
        return lecture;
    }

    /**
     * Sanitizes strings to ISO-8859-1 / WinAnsiEncoding compatible ASCII characters
     * to prevent PDFBox font encoding exceptions on formulas, Unicode math, and special symbols.
     */
    public String sanitizePdfText(String text) {
        if (text == null) return "";
        return text.replace("\r\n", " ")
                .replace("\r", " ")
                .replace("\n", " ")
                .replace("\t", " ")
                .replace("“", "\"").replace("”", "\"")
                .replace("‘", "'").replace("’", "'")
                .replace("—", " - ").replace("–", "-")
                .replace("•", "*")
                .replace("π", "pi").replace("Π", "Pi")
                .replace("√", "sqrt")
                .replace("±", "+/-")
                .replace("²", "^2").replace("³", "^3")
                .replace("≤", "<=").replace("≥", ">=")
                .replace("≠", "!=")
                .replace("×", "*").replace("÷", "/")
                .replace("→", "->").replace("←", "<-")
                .replaceAll("[^\\x20-\\x7E]", " ")
                .trim();
    }

    private String formatTime(Double sec) {
        if (sec == null || sec < 0) return "00:00";
        int m = (int) (sec / 60);
        int s = (int) (sec % 60);
        return String.format("%02d:%02d", m, s);
    }

    /**
     * Generates clean, multi-page Transcript PDF
     */
    @Transactional(readOnly = true)
    public byte[] generateTranscriptPdf(String lectureIdentifier, User currentUser) throws IOException {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        List<TranscriptSegment> segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(lecture.getId());
        Optional<Transcript> transcriptOpt = transcriptRepository.findByLectureId(lecture.getId());

        try (PDDocument document = new PDDocument()) {
            PdfDocumentContext ctx = new PdfDocumentContext(document, "Lecture Transcript", lecture);

            if (segments.isEmpty() && transcriptOpt.isPresent() && transcriptOpt.get().getFullText() != null) {
                String fullText = transcriptOpt.get().getFullText();
                for (String line : fullText.split("\\n+")) {
                    if (!line.isBlank()) {
                        ctx.writeParagraph(line.trim(), 50, 10, FONT_BODY);
                    }
                }
            } else if (!segments.isEmpty()) {
                for (TranscriptSegment seg : segments) {
                    ctx.checkPageBreak(30);
                    String timeLabel = "[" + formatTime(seg.getStartTime()) + "] " +
                            (seg.getSpeakerName() != null ? seg.getSpeakerName() : "Speaker") + ": ";
                    String text = seg.getText() != null ? seg.getText() : "";

                    ctx.writeTimestampedSegment(timeLabel, text);
                }
            } else {
                ctx.writeParagraph("No transcript recorded for this lecture.", 50, 11, FONT_BODY);
            }

            ctx.finishDocument();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }

    /**
     * Generates structured Executive Summary PDF
     */
    @Transactional(readOnly = true)
    public byte[] generateSummaryPdf(String lectureIdentifier, User currentUser) throws IOException {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        Summary summary = summaryRepository.findByLectureId(lecture.getId()).orElse(null);
        List<LectureChapter> chapters = chapterRepository.findByLectureIdOrderByStartTimeAsc(lecture.getId());

        try (PDDocument document = new PDDocument()) {
            PdfDocumentContext ctx = new PdfDocumentContext(document, "Lecture Executive Summary", lecture);

            if (summary == null) {
                ctx.writeParagraph("No executive summary has been generated for this lecture yet.", 50, 11, FONT_BODY);
            } else {
                // Short Summary
                ctx.writeSectionHeader("Executive Overview");
                if (summary.getShortSummary() != null) {
                    for (String line : summary.getShortSummary().split("\\n+")) {
                        ctx.writeParagraph(line, 50, 10, FONT_BODY);
                    }
                }

                // Detailed Summary
                if (summary.getDetailedSummary() != null) {
                    ctx.writeSectionHeader("Detailed Synthesis");
                    for (String line : summary.getDetailedSummary().split("\\n+")) {
                        ctx.writeParagraph(line, 50, 10, FONT_BODY);
                    }
                }

                // Key Concepts
                if (summary.getKeyConceptsJson() != null) {
                    try {
                        List<KeyConceptDto> concepts = MAPPER.readValue(summary.getKeyConceptsJson(), new TypeReference<List<KeyConceptDto>>() {});
                        if (!concepts.isEmpty()) {
                            ctx.writeSectionHeader("Key Concepts");
                            for (KeyConceptDto kc : concepts) {
                                ctx.writeBoldItem(kc.getConcept() != null ? kc.getConcept() : "Concept",
                                        kc.getDescription() != null ? kc.getDescription() : "");
                            }
                        }
                    } catch (Exception ignored) {}
                }

                // Key Takeaways
                if (summary.getKeyTakeawaysJson() != null) {
                    try {
                        List<String> takeaways = MAPPER.readValue(summary.getKeyTakeawaysJson(), new TypeReference<List<String>>() {});
                        if (!takeaways.isEmpty()) {
                            ctx.writeSectionHeader("Key Takeaways");
                            for (String t : takeaways) {
                                ctx.writeParagraph("* " + t, 50, 10, FONT_BODY);
                            }
                        }
                    } catch (Exception ignored) {}
                }

                // Chapters
                if (!chapters.isEmpty()) {
                    ctx.writeSectionHeader("Lecture Chapters");
                    for (LectureChapter ch : chapters) {
                        String time = "[" + formatTime(ch.getStartTime()) + " - " + formatTime(ch.getEndTime()) + "] ";
                        ctx.writeBoldItem(time + ch.getTitle(), ch.getSummary() != null ? ch.getSummary() : "");
                    }
                }
            }

            ctx.finishDocument();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }

    /**
     * Generates structured Study Notes PDF with formulas and sections
     */
    @Transactional(readOnly = true)
    public byte[] generateStudyNotesPdf(String lectureIdentifier, String mode, User currentUser) throws IOException {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        String targetMode = (mode != null && !mode.isBlank()) ? mode.trim() : "detailed";
        StudyNote note = studyNoteRepository.findByLectureIdAndMode(lecture.getId(), targetMode).orElse(null);

        try (PDDocument document = new PDDocument()) {
            PdfDocumentContext ctx = new PdfDocumentContext(document, "Structured Study Notes (" + targetMode.toUpperCase() + ")", lecture);

            if (note == null) {
                ctx.writeParagraph("No study notes have been generated for this mode (" + targetMode + ") yet.", 50, 11, FONT_BODY);
            } else {
                // Structured Sections
                if (note.getSectionsJson() != null) {
                    try {
                        List<StudySectionDto> sections = MAPPER.readValue(note.getSectionsJson(), new TypeReference<List<StudySectionDto>>() {});
                        for (StudySectionDto sec : sections) {
                            ctx.writeSectionHeader(sec.getHeading() != null ? sec.getHeading() : "Section");
                            if (sec.getFormula() != null && !sec.getFormula().isBlank()) {
                                ctx.writeFormulaBlock("Formula: " + sec.getFormula());
                            }
                            if (sec.getExplanation() != null && !sec.getExplanation().isBlank()) {
                                ctx.writeParagraph(sec.getExplanation(), 50, 10, FONT_BODY);
                            }
                            if (sec.getDerivationOrExample() != null && !sec.getDerivationOrExample().isBlank()) {
                                ctx.writeBoldItem("Derivation / Example", sec.getDerivationOrExample());
                            }
                            if (sec.getTakeaway() != null && !sec.getTakeaway().isBlank()) {
                                ctx.writeBoldItem("Key Takeaway", sec.getTakeaway());
                            }
                        }
                    } catch (Exception ignored) {}
                }

                // Formulas
                if (note.getFormulasJson() != null) {
                    try {
                        List<FormulaDto> formulas = MAPPER.readValue(note.getFormulasJson(), new TypeReference<List<FormulaDto>>() {});
                        if (!formulas.isEmpty()) {
                            ctx.writeSectionHeader("Mathematical Formulas & Invariants");
                            for (FormulaDto f : formulas) {
                                ctx.writeFormulaBlock(f.getName() + ": " + f.getExpression());
                                if (f.getDescription() != null && !f.getDescription().isBlank()) {
                                    ctx.writeParagraph(f.getDescription(), 60, 9, FONT_BODY);
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            ctx.finishDocument();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }

    /**
     * Inner helper class managing multi-page flow, margin calculation, and page numbering.
     */
    private class PdfDocumentContext {
        final PDDocument doc;
        final String docTypeTitle;
        final Lecture lecture;
        PDPage currentPage;
        PDPageContentStream contentStream;
        float y;

        PdfDocumentContext(PDDocument doc, String docTypeTitle, Lecture lecture) throws IOException {
            this.doc = doc;
            this.docTypeTitle = docTypeTitle;
            this.lecture = lecture;
            newPage();
            writeDocumentHeader();
        }

        void newPage() throws IOException {
            if (contentStream != null) {
                contentStream.close();
            }
            currentPage = new PDPage(PDRectangle.A4);
            doc.addPage(currentPage);
            contentStream = new PDPageContentStream(doc, currentPage);
            y = 770;
        }

        void checkPageBreak(float neededHeight) throws IOException {
            if (y - neededHeight < 55) {
                newPage();
                // Sub-header on subsequent pages
                contentStream.beginText();
                contentStream.setFont(FONT_BODY, 8);
                contentStream.newLineAtOffset(50, 800);
                contentStream.showText(sanitizePdfText("LectureLens — " + docTypeTitle + " | " + (lecture != null ? lecture.getTitle() : "")));
                contentStream.endText();
                y = 770;
            }
        }

        void writeDocumentHeader() throws IOException {
            contentStream.beginText();
            contentStream.setFont(FONT_TITLE, 16);
            contentStream.newLineAtOffset(50, y);
            contentStream.showText(sanitizePdfText("LectureLens — " + docTypeTitle));
            contentStream.endText();
            y -= 22;

            contentStream.beginText();
            contentStream.setFont(FONT_HEADING, 11);
            contentStream.newLineAtOffset(50, y);
            String title = lecture != null && lecture.getTitle() != null ? lecture.getTitle() : "Lecture Session";
            contentStream.showText(sanitizePdfText("Lecture: " + title));
            contentStream.endText();
            y -= 16;

            contentStream.beginText();
            contentStream.setFont(FONT_BODY, 9);
            contentStream.newLineAtOffset(50, y);
            String instructor = lecture != null && lecture.getHostName() != null ? lecture.getHostName() : "Instructor";
            String date = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").format(LocalDateTime.now());
            contentStream.showText(sanitizePdfText("Instructor: " + instructor + "  |  Exported: " + date));
            contentStream.endText();
            y -= 25;
        }

        void writeSectionHeader(String heading) throws IOException {
            checkPageBreak(35);
            y -= 8;
            contentStream.beginText();
            contentStream.setFont(FONT_HEADING, 12);
            contentStream.newLineAtOffset(50, y);
            contentStream.showText(sanitizePdfText(heading));
            contentStream.endText();
            y -= 18;
        }

        void writeParagraph(String text, float x, float fontSize, PDType1Font font) throws IOException {
            String sanitized = sanitizePdfText(text);
            if (sanitized.isEmpty()) return;

            // Simple word wrap
            int maxChars = (int) ((PDRectangle.A4.getWidth() - x - 50) / (fontSize * 0.52f));
            String[] words = sanitized.split("\\s+");
            StringBuilder line = new StringBuilder();

            for (String word : words) {
                if (line.length() + word.length() + 1 > maxChars) {
                    checkPageBreak(fontSize + 6);
                    contentStream.beginText();
                    contentStream.setFont(font, fontSize);
                    contentStream.newLineAtOffset(x, y);
                    contentStream.showText(line.toString());
                    contentStream.endText();
                    y -= (fontSize + 4);
                    line = new StringBuilder(word);
                } else {
                    if (line.length() > 0) line.append(" ");
                    line.append(word);
                }
            }
            if (line.length() > 0) {
                checkPageBreak(fontSize + 6);
                contentStream.beginText();
                contentStream.setFont(font, fontSize);
                contentStream.newLineAtOffset(x, y);
                contentStream.showText(line.toString());
                contentStream.endText();
                y -= (fontSize + 6);
            }
        }

        void writeBoldItem(String title, String description) throws IOException {
            checkPageBreak(25);
            contentStream.beginText();
            contentStream.setFont(FONT_HEADING, 10);
            contentStream.newLineAtOffset(50, y);
            contentStream.showText(sanitizePdfText(title + ":"));
            contentStream.endText();
            y -= 14;

            if (description != null && !description.isBlank()) {
                writeParagraph(description, 60, 9.5f, FONT_BODY);
            }
        }

        void writeFormulaBlock(String formula) throws IOException {
            checkPageBreak(24);
            contentStream.beginText();
            contentStream.setFont(FONT_CODE, 10);
            contentStream.newLineAtOffset(60, y);
            contentStream.showText(sanitizePdfText("[Formula] " + formula));
            contentStream.endText();
            y -= 16;
        }

        void writeTimestampedSegment(String timeLabel, String text) throws IOException {
            checkPageBreak(18);
            contentStream.beginText();
            contentStream.setFont(FONT_HEADING, 9);
            contentStream.newLineAtOffset(50, y);
            contentStream.showText(sanitizePdfText(timeLabel));
            contentStream.endText();

            writeParagraph(text, 140, 9, FONT_BODY);
        }

        void finishDocument() throws IOException {
            if (contentStream != null) {
                contentStream.close();
            }

            // Two-pass page numbering ("Page X of Y")
            int totalPages = doc.getNumberOfPages();
            for (int i = 0; i < totalPages; i++) {
                PDPage p = doc.getPage(i);
                try (PDPageContentStream footerStream = new PDPageContentStream(doc, p, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    footerStream.beginText();
                    footerStream.setFont(FONT_BODY, 8);
                    footerStream.newLineAtOffset(PDRectangle.A4.getWidth() / 2 - 30, 30);
                    footerStream.showText(String.format("Page %d of %d", i + 1, totalPages));
                    footerStream.endText();
                }
            }
        }
    }
}
