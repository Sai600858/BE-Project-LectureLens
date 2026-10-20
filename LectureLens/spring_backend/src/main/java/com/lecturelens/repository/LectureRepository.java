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
    Optional<Lecture> findByIdOrRoomId(String id, String roomId);
    boolean existsByRoomId(String roomId);
    List<Lecture> findByStatus(LectureStatus status);
    long countByStatus(LectureStatus status);
    List<Lecture> findByHostId(String hostId);
    List<Lecture> findAllByOrderByCreatedAtDesc();
    List<Lecture> findByStatusOrderByCreatedAtDesc(LectureStatus status);
    List<Lecture> findByHostIdOrderByCreatedAtDesc(String hostId);
    List<Lecture> findByStatusAndHostIdOrderByCreatedAtDesc(LectureStatus status, String hostId);
}
