package com.lecturelens.repository;

import com.lecturelens.model.StudyNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudyNoteRepository extends JpaRepository<StudyNote, String> {
    Optional<StudyNote> findByLectureIdAndMode(String lectureId, String mode);
    List<StudyNote> findByLectureId(String lectureId);
    void deleteByLectureIdAndMode(String lectureId, String mode);
    boolean existsByLectureIdAndMode(String lectureId, String mode);
}
