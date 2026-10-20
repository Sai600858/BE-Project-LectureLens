package com.lecturelens.service;

import com.lecturelens.dto.VisionAnalysisDto;

public interface VisionWorkerClient {
    VisionAnalysisDto analyzeFrame(String frameType, String lectureId, String imageBase64, Double timestamp, String imagePath);
}
