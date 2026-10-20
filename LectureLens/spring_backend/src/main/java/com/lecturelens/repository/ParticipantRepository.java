package com.lecturelens.repository;

import com.lecturelens.model.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, String> {
    List<Participant> findByLectureId(String lectureId);
    Optional<Participant> findByLectureIdAndUserId(String lectureId, String userId);
    boolean existsByLectureIdAndUserId(String lectureId, String userId);
}
