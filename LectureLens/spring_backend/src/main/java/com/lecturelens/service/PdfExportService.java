package com.lecturelens.service;

import com.lecturelens.model.Lecture;
import com.lecturelens.model.TranscriptSegment;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

@Service
public class PdfExportService {

    public byte[] generateTranscriptPdf(Lecture lecture, List<TranscriptSegment> segments) throws IOException {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);

            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.beginText();
                contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 16);
                contentStream.newLineAtOffset(50, 750);
                contentStream.showText("LectureLens — Lecture Transcript");
                contentStream.endText();

                contentStream.beginText();
                contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                contentStream.newLineAtOffset(50, 725);
                contentStream.showText("Lecture: " + (lecture != null ? lecture.getTitle() : "Session"));
                contentStream.endText();

                float y = 690;
                for (TranscriptSegment segment : segments) {
                    if (y < 60) break; // Simple page boundary

                    contentStream.beginText();
                    contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                    contentStream.newLineAtOffset(50, y);
                    contentStream.showText("[" + formatTime(segment.getStartTime()) + "] " + segment.getSpeakerName() + ": ");
                    contentStream.endText();

                    contentStream.beginText();
                    contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 9);
                    contentStream.newLineAtOffset(150, y);
                    String text = segment.getText();
                    if (text.length() > 65) text = text.substring(0, 65) + "...";
                    contentStream.showText(text);
                    contentStream.endText();

                    y -= 18;
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }

    private String formatTime(Double sec) {
        if (sec == null) return "00:00";
        int m = (int) (sec / 60);
        int s = (int) (sec % 60);
        return String.format("%02d:%02d", m, s);
    }
}
