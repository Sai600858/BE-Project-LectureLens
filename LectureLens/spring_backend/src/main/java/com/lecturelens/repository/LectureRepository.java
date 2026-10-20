package com.lecturelens.repository;

import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LectureRepository extends JpaRepository<Lecture, String> {
    Optional<Lecture> findByRoomId(String roomId);
    List<Lecture> findByStatus(LectureStatus status);
    List<Lecture> findByHostId(String hostId);
    List<Lecture> findAllByOrderByCreatedAtDesc();
}
