package com.lecturelens.repository;

import com.lecturelens.model.LectureChapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LectureChapterRepository extends JpaRepository<LectureChapter, String> {
    List<LectureChapter> findByLectureIdOrderByStartTimeAsc(String lectureId);
    void deleteByLectureId(String lectureId);
    long countByLectureId(String lectureId);
}
