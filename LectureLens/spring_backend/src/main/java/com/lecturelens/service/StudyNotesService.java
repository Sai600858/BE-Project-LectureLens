package com.lecturelens.service;

import com.lecturelens.dto.StudyNotesDto;

public interface StudyNotesService {

    StudyNotesDto getStudyNotes(String lectureIdentifier, String mode, String currentUserId, String currentUserRole);

    StudyNotesDto generateStudyNotes(String lectureIdentifier, String mode, boolean forceRegenerate, String currentUserId, String currentUserRole);

    StudyNotesDto updateStudyNotes(String lectureIdentifier, String mode, String updatedMarkdown, String currentUserId, String currentUserRole);
}
