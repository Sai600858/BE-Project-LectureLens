package com.lecturelens.repository;

import com.lecturelens.model.ScreenContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScreenContentRepository extends JpaRepository<ScreenContent, String> {
    List<ScreenContent> findByLectureIdOrderByTimestampAsc(String lectureId);
    Optional<ScreenContent> findByLectureIdAndImageHash(String lectureId, String imageHash);
}
