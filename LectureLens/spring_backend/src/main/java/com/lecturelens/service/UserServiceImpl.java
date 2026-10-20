package com.lecturelens.service;

import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.AdminStatsResponse;
import com.lecturelens.dto.UserDto;
import com.lecturelens.dto.UserListResponse;
import com.lecturelens.model.LectureStatus;
import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.RecordingRepository;
import com.lecturelens.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private RecordingRepository recordingRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDto getUserProfile(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return UserDto.fromEntity(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserListResponse listAllUsers() {
        List<User> users = userRepository.findAllByOrderByCreatedAtDesc();
        List<UserDto> dtos = users.stream()
                .map(UserDto::fromEntity)
                .collect(Collectors.toList());
        return new UserListResponse(dtos);
    }

    @Override
    @Transactional
    public void deleteUser(String targetUserId, String currentAdminId) {
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new IllegalArgumentException("Target user ID is required");
        }
        if (targetUserId.equals(currentAdminId)) {
            throw new IllegalArgumentException("Cannot delete your own account");
        }

        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == Role.ADMIN) {
            long adminCount = userRepository.countByRole(Role.ADMIN);
            if (adminCount <= 1) {
                throw new IllegalArgumentException("Cannot delete the last administrator");
            }
        }

        userRepository.delete(user);
        log.info("[Admin] Admin '{}' deleted user '{}' ({})", currentAdminId, targetUserId, user.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public AdminStatsResponse getAdminStats() {
        long totalUsers = userRepository.count();
        long totalLectures = lectureRepository.count();
        long totalRecordings = recordingRepository.count();
        int activeRooms = (int) lectureRepository.countByStatus(LectureStatus.LIVE);

        return new AdminStatsResponse(totalUsers, totalLectures, totalRecordings, activeRooms);
    }
}
