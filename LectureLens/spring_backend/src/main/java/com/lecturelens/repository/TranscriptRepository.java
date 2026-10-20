package com.lecturelens.repository;

import com.lecturelens.model.Transcript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TranscriptRepository extends JpaRepository<Transcript, String> {
    Optional<Transcript> findByLectureId(String lectureId);
}
