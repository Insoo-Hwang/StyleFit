package com.stylefit.vision;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import org.opencv.core.Core;
import org.opencv.core.Mat;
import org.opencv.core.MatOfByte;
import org.opencv.core.Scalar;
import org.opencv.core.Size;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.opencv.objdetect.FaceDetectorYN;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PhotoValidationService {

	private final Path yunetModelPath;
	private final double minBrightness;
	private final double maxBrightness;
	private final float faceScoreThreshold;
	private final double minFaceAreaRatio;

	public PhotoValidationService(
		@Value("${stylefit.vision.yunet-model}") Resource yunetModel,
		@Value("${stylefit.vision.min-brightness}") double minBrightness,
		@Value("${stylefit.vision.max-brightness}") double maxBrightness,
		@Value("${stylefit.vision.face-score-threshold}") float faceScoreThreshold,
		@Value("${stylefit.vision.min-face-area-ratio}") double minFaceAreaRatio
	) throws IOException {
		this.yunetModelPath = copyResourceToTempFile(yunetModel);
		this.minBrightness = minBrightness;
		this.maxBrightness = maxBrightness;
		this.faceScoreThreshold = faceScoreThreshold;
		this.minFaceAreaRatio = minFaceAreaRatio;
	}

	public PhotoValidationResponse validate(MultipartFile file) throws IOException {
		if (file.isEmpty()) {
			return new PhotoValidationResponse(false, 0, 0, 0, List.of("사진 파일을 첨부해주세요."));
		}

		Mat image = decodeImage(file);
		if (image.empty()) {
			return new PhotoValidationResponse(false, 0, 0, 0, List.of("이미지 파일을 읽을 수 없습니다."));
		}

		FaceDetectionResult faceDetectionResult = detectFaces(image);
		double brightness = calculateBrightness(image);
		List<String> warnings = new ArrayList<>();

		if (faceDetectionResult.faceCount() == 0) {
			warnings.add("얼굴이 보이지 않습니다.");
		} else if (faceDetectionResult.faceCount() > 1) {
			warnings.add("한 명만 촬영된 사진을 업로드해주세요.");
		} else if (faceDetectionResult.largestFaceAreaRatio() < minFaceAreaRatio) {
			warnings.add("얼굴이 너무 작게 촬영되었습니다. 얼굴이 더 크게 보이도록 다시 촬영해주세요.");
		}

		if (brightness < minBrightness) {
			warnings.add("사진이 너무 어둡습니다.");
		} else if (brightness > maxBrightness) {
			warnings.add("사진이 너무 밝습니다.");
		}

		return new PhotoValidationResponse(
			warnings.isEmpty(),
			faceDetectionResult.faceCount(),
			faceDetectionResult.largestFaceAreaRatio(),
			brightness,
			warnings
		);
	}

	private Mat decodeImage(MultipartFile file) throws IOException {
		MatOfByte bytes = new MatOfByte(file.getBytes());
		return Imgcodecs.imdecode(bytes, Imgcodecs.IMREAD_COLOR);
	}

	private FaceDetectionResult detectFaces(Mat image) {
		FaceDetectorYN detector = FaceDetectorYN.create(
			yunetModelPath.toString(),
			"",
			new Size(image.cols(), image.rows()),
			faceScoreThreshold,
			0.3f,
			5000
		);

		Mat faces = new Mat();
		detector.detect(image, faces);
		return new FaceDetectionResult(faces.rows(), calculateLargestFaceAreaRatio(faces, image));
	}

	private double calculateLargestFaceAreaRatio(Mat faces, Mat image) {
		if (faces.empty()) {
			return 0;
		}

		double largestFaceArea = 0;
		for (int i = 0; i < faces.rows(); i++) {
			double width = faces.get(i, 2)[0];
			double height = faces.get(i, 3)[0];
			largestFaceArea = Math.max(largestFaceArea, width * height);
		}

		return largestFaceArea / (image.cols() * image.rows());
	}

	private double calculateBrightness(Mat image) {
		Mat gray = new Mat();
		Imgproc.cvtColor(image, gray, Imgproc.COLOR_BGR2GRAY);
		Scalar mean = Core.mean(gray);
		return mean.val[0];
	}

	private Path copyResourceToTempFile(Resource resource) throws IOException {
		Path tempFile = Files.createTempFile("stylefit-yunet-", ".onnx");
		tempFile.toFile().deleteOnExit();

		try (InputStream inputStream = resource.getInputStream()) {
			Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
		}

		return tempFile;
	}

	private record FaceDetectionResult(
		int faceCount,
		double largestFaceAreaRatio
	) {
	}
}
