package com.lecturelens.repository;

import com.lecturelens.model.GeneratedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, String> {

    @Query("SELECT d FROM GeneratedDocument d WHERE d.lecture.id = :lectureId")
    List<GeneratedDocument> findByLectureId(@Param("lectureId") String lectureId);

    @Query("SELECT d FROM GeneratedDocument d WHERE d.lecture.id = :lectureId AND d.docType = :docType")
    Optional<GeneratedDocument> findByLectureIdAndDocType(@Param("lectureId") String lectureId, @Param("docType") String docType);
}
