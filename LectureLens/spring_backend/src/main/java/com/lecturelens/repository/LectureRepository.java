package com.lecturelens.repository;

import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    @Query("SELECT l FROM Lecture l WHERE l.host.id = :hostId")
    List<Lecture> findByHostId(@Param("hostId") String hostId);

    List<Lecture> findAllByOrderByCreatedAtDesc();
    List<Lecture> findByStatusOrderByCreatedAtDesc(LectureStatus status);

    @Query("SELECT l FROM Lecture l WHERE l.host.id = :hostId ORDER BY l.createdAt DESC")
    List<Lecture> findByHostIdOrderByCreatedAtDesc(@Param("hostId") String hostId);

    @Query("SELECT l FROM Lecture l WHERE l.status = :status AND l.host.id = :hostId ORDER BY l.createdAt DESC")
    List<Lecture> findByStatusAndHostIdOrderByCreatedAtDesc(@Param("status") LectureStatus status, @Param("hostId") String hostId);
}
