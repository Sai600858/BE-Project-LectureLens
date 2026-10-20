package com.lecturelens.repository;

import com.lecturelens.model.Recording;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecordingRepository extends JpaRepository<Recording, String> {
    Optional<Recording> findByLectureId(String lectureId);
    boolean existsByLectureId(String lectureId);
}
