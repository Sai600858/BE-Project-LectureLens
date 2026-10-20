package com.lecturelens.controller;

import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import com.lecturelens.model.User;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/lectures")
public class LectureController {

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getAllLectures() {
        List<Lecture> lectures = lectureRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(Map.of("lectures", lectures));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getLectureById(@PathVariable String id) {
        Lecture lecture = lectureRepository.findById(id)
                .or(() -> lectureRepository.findByRoomId(id))
                .orElse(null);

        if (lecture == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("lecture", lecture));
    }

    @PostMapping
    public ResponseEntity<?> createLecture(@RequestBody Map<String, String> body) {
        String title = body.get("title");
        String description = body.getOrDefault("description", "");
        String hostId = body.getOrDefault("hostId", "user_teacher_1");

        User host = userRepository.findById(hostId).orElseGet(() -> {
            List<User> users = userRepository.findAll();
            return users.isEmpty() ? null : users.get(0);
        });

        if (host == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Host user not found"));
        }

        String lectureId = "lec_" + UUID.randomUUID().toString().substring(0, 8);
        String roomId = UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Lecture lecture = new Lecture();
        lecture.setId(lectureId);
        lecture.setRoomId(roomId);
        lecture.setTitle(title);
        lecture.setDescription(description);
        lecture.setHost(host);
        lecture.setStatus(LectureStatus.SCHEDULED);

        lectureRepository.save(lecture);
        return ResponseEntity.ok(Map.of("lecture", lecture));
    }
}
