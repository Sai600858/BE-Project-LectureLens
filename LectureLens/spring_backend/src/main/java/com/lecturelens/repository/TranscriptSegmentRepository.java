package com.lecturelens.repository;

import com.lecturelens.model.TranscriptSegment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TranscriptSegmentRepository extends JpaRepository<TranscriptSegment, Long> {
    List<TranscriptSegment> findByLectureIdOrderByStartTimeAsc(String lectureId);
    List<TranscriptSegment> findByLectureIdAndTextContainingIgnoreCase(String lectureId, String query);
}
