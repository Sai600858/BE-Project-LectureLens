package com.lecturelens.repository;

import com.lecturelens.model.SalkgGuardReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalkgGuardReportRepository extends JpaRepository<SalkgGuardReport, String> {
    List<SalkgGuardReport> findByLectureIdOrderByCreatedAtDesc(String lectureId);
    Optional<SalkgGuardReport> findByIdAndLectureId(String id, String lectureId);
}
