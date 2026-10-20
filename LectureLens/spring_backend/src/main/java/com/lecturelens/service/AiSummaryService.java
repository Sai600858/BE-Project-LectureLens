package com.lecturelens.service;

import com.lecturelens.dto.SummaryDto;

public interface AiSummaryService {

    SummaryDto getSummary(String lectureIdentifier, String currentUserId, String currentUserRole);

    SummaryDto generateSummary(String lectureIdentifier, boolean forceRegenerate, String currentUserId, String currentUserRole);
}
