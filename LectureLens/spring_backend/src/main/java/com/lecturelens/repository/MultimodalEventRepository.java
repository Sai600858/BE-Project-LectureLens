package com.lecturelens.repository;

import com.lecturelens.model.MultimodalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MultimodalEventRepository extends JpaRepository<MultimodalEvent, String> {
    List<MultimodalEvent> findByLectureIdOrderByTimestampAsc(String lectureId);
}
