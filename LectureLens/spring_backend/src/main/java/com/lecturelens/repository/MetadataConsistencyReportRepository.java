package com.lecturelens.repository;

import com.lecturelens.model.MetadataConsistencyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MetadataConsistencyReportRepository extends JpaRepository<MetadataConsistencyReport, String> {
    List<MetadataConsistencyReport> findByLectureIdOrderByCreatedAtDesc(String lectureId);
    Optional<MetadataConsistencyReport> findTopByLectureIdOrderByCreatedAtDesc(String lectureId);
}
