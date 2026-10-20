package com.lecturelens.repository;

import com.lecturelens.model.SalkgCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalkgCacheRepository extends JpaRepository<SalkgCache, String> {
    Optional<SalkgCache> findByLectureId(String lectureId);
}
