package com.lecturelens.repository;

import com.lecturelens.model.GeneratedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, String> {
    List<GeneratedDocument> findByLectureId(String lectureId);
    Optional<GeneratedDocument> findByLectureIdAndDocType(String lectureId, String docType);
}
