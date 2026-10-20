package com.lecturelens.repository;

import com.lecturelens.model.TranscriptSegment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TranscriptSegmentRepository extends JpaRepository<TranscriptSegment, Long> {
    List<TranscriptSegment> findByLectureIdOrderByStartTimeAsc(String lectureId);
    Page<TranscriptSegment> findByLectureIdOrderByStartTimeAsc(String lectureId, Pageable pageable);
    Optional<TranscriptSegment> findByLectureIdAndChunkId(String lectureId, Long chunkId);
    List<TranscriptSegment> findByLectureIdAndTextContainingIgnoreCase(String lectureId, String query);
    long countByLectureId(String lectureId);
}

