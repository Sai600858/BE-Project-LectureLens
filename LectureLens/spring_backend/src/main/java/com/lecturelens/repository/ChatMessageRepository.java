package com.lecturelens.repository;

import com.lecturelens.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, String> {

    @Query("SELECT m FROM ChatMessage m WHERE m.lecture.id = :lectureId ORDER BY m.timestamp ASC")
    List<ChatMessage> findByLectureIdOrderByTimestampAsc(@Param("lectureId") String lectureId);

    @Query("SELECT m FROM ChatMessage m WHERE m.lecture.id = :lectureId AND m.userId = :userId ORDER BY m.timestamp ASC")
    List<ChatMessage> findByLectureIdAndUserIdOrderByTimestampAsc(@Param("lectureId") String lectureId, @Param("userId") String userId);
}
