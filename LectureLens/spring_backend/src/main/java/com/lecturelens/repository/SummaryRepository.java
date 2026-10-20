package com.lecturelens.repository;

import com.lecturelens.model.Summary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SummaryRepository extends JpaRepository<Summary, String> {
    Optional<Summary> findByLectureId(String lectureId);
}
