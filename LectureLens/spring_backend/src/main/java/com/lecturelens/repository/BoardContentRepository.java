package com.lecturelens.repository;

import com.lecturelens.model.BoardContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BoardContentRepository extends JpaRepository<BoardContent, String> {
    List<BoardContent> findByLectureIdOrderByTimestampAsc(String lectureId);
    Optional<BoardContent> findByLectureIdAndImageHash(String lectureId, String imageHash);
}
