package com.stylefit.vision;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import org.opencv.core.Core;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.MatOfByte;
import org.opencv.core.MatOfDouble;
import org.opencv.core.Rect;
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

	private final FaceDetectorYN detector;
	private final double minBrightness;
	private final double maxBrightness;
	private final double minFaceAreaRatio;
	private final double minBlurVariance;
	private final double maxYawRatio;
	private final double minPitchRatio;
	private final double maxPitchRatio;
	private final double maxBacklightRatio;
	private final double minFaceSaturation;
	private final double maxFaceSaturation;

	public PhotoValidationService(
		@Value("${stylefit.vision.yunet-model}") Resource yunetModel,
		@Value("${stylefit.vision.min-brightness}") double minBrightness,
		@Value("${stylefit.vision.max-brightness}") double maxBrightness,
		@Value("${stylefit.vision.face-score-threshold}") float faceScoreThreshold,
		@Value("${stylefit.vision.min-face-area-ratio}") double minFaceAreaRatio,
		@Value("${stylefit.vision.min-blur-variance:80}") double minBlurVariance,
		@Value("${stylefit.vision.max-yaw-ratio:0.18}") double maxYawRatio,
		@Value("${stylefit.vision.min-pitch-ratio:0.5}") double minPitchRatio,
		@Value("${stylefit.vision.max-pitch-ratio:1.8}") double maxPitchRatio,
		@Value("${stylefit.vision.max-backlight-ratio:0.55}") double maxBacklightRatio,
		@Value("${stylefit.vision.min-face-saturation:20}") double minFaceSaturation,
		@Value("${stylefit.vision.max-face-saturation:180}") double maxFaceSaturation
	) throws IOException {
		nu.pattern.OpenCV.loadLocally();
		Path modelPath = copyResourceToTempFile(yunetModel);
		this.detector = FaceDetectorYN.create(modelPath.toString(), "", new Size(320, 320), faceScoreThreshold, 0.3f, 5000);
		this.minBrightness = minBrightness;
		this.maxBrightness = maxBrightness;
		this.minFaceAreaRatio = minFaceAreaRatio;
		this.minBlurVariance = minBlurVariance;
		this.maxYawRatio = maxYawRatio;
		this.minPitchRatio = minPitchRatio;
		this.maxPitchRatio = maxPitchRatio;
		this.maxBacklightRatio = maxBacklightRatio;
		this.minFaceSaturation = minFaceSaturation;
		this.maxFaceSaturation = maxFaceSaturation;
	}

	public PhotoValidationResponse validate(MultipartFile file) throws IOException {
		if (file.isEmpty()) {
			return new PhotoValidationResponse(false, 0, 0, 0, List.of("사진 파일을 첨부해주세요."));
		}

		byte[] bytes = file.getBytes();
		if (!isAcceptableImageMagic(bytes)) {
			return new PhotoValidationResponse(false, 0, 0, 0,
				List.of("지원되지 않는 이미지 형식입니다. JPG 또는 PNG 파일만 업로드해주세요."));
		}

		Mat image = decodeImage(bytes);
		if (image.empty()) {
			return new PhotoValidationResponse(false, 0, 0, 0, List.of("이미지 파일을 읽을 수 없습니다."));
		}

		Mat detectionInput = resizeForDetection(image);
		FaceDetection face = detectFaces(detectionInput);
		double brightness = calculateBrightness(image);
		List<String> warnings = new ArrayList<>();

		if (face.faceCount == 0) {
			warnings.add("얼굴이 보이지 않습니다.");
		} else if (face.faceCount > 1) {
			warnings.add("한 명만 촬영된 사진을 업로드해주세요.");
		} else if (face.areaRatio < minFaceAreaRatio) {
			warnings.add("얼굴이 너무 작게 촬영되었습니다. 얼굴이 더 크게 보이도록 다시 촬영해주세요.");
		} else {
			// 단일 얼굴인 경우에만 추가 정확도 검증
			Rect faceRect = clampRect(face.bbox, detectionInput);

			// 1) 블러 (Laplacian variance) — 흔들리거나 초점 안 맞은 사진 차단
			double blurVariance = calculateBlurVariance(detectionInput, faceRect);
			if (blurVariance < minBlurVariance) {
				warnings.add("사진이 흐릿합니다. 초점이 맞은 선명한 사진을 업로드해주세요.");
			}

			// 2) 얼굴 각도 — yaw (좌우 회전)
			double yawRatio = calculateYawRatio(face);
			if (yawRatio > maxYawRatio) {
				warnings.add("얼굴이 정면을 향하지 않습니다. 정면을 보고 다시 촬영해주세요.");
			}

			// 3) 얼굴 각도 — pitch (상하 기울기)
			double pitchRatio = calculatePitchRatio(face);
			if (pitchRatio < minPitchRatio || pitchRatio > maxPitchRatio) {
				warnings.add("얼굴 각도가 정면과 달라 보입니다. 카메라 정면을 응시해주세요.");
			}

			// 4) 역광 — 얼굴 영역이 배경보다 너무 어두우면 거부
			double backlightRatio = calculateBacklightRatio(detectionInput, faceRect);
			if (backlightRatio < maxBacklightRatio) {
				warnings.add("역광으로 얼굴이 어둡게 촬영되었습니다. 빛이 얼굴 정면을 비추도록 해주세요.");
			}

			// 5) 피부톤 색역 — 흑백 / 과채도 필터 차단
			double faceSaturation = calculateFaceSaturation(detectionInput, faceRect);
			if (faceSaturation < minFaceSaturation) {
				warnings.add("흑백 또는 채도가 낮은 사진은 분석이 어렵습니다. 자연스러운 컬러 사진을 업로드해주세요.");
			} else if (faceSaturation > maxFaceSaturation) {
				warnings.add("필터가 강하게 적용된 사진은 분석이 어렵습니다. 보정 없이 다시 촬영해주세요.");
			}
		}

		if (brightness < minBrightness) {
			warnings.add("사진이 너무 어둡습니다.");
		} else if (brightness > maxBrightness) {
			warnings.add("사진이 너무 밝습니다.");
		}

		return new PhotoValidationResponse(
			warnings.isEmpty(),
			face.faceCount,
			face.areaRatio,
			brightness,
			warnings
		);
	}

	private Mat decodeImage(byte[] bytes) {
		MatOfByte buf = new MatOfByte(bytes);
		// IMREAD_COLOR 로 디코딩하면 결과 Mat 에는 EXIF / 메타데이터가 포함되지 않는다.
		// 향후 AI 모듈로 전달할 때 이 Mat 을 다시 imencode 해서 보내면 자연스럽게 EXIF 제거됨.
		return Imgcodecs.imdecode(buf, Imgcodecs.IMREAD_COLOR);
	}

	/**
	 * 매직 바이트로 실제 이미지 포맷을 확인 (확장자 위조 차단).
	 * JPEG: FF D8 FF
	 * PNG:  89 50 4E 47 0D 0A 1A 0A
	 */
	private static boolean isAcceptableImageMagic(byte[] bytes) {
		if (bytes == null || bytes.length < 8) return false;
		if ((bytes[0] & 0xFF) == 0xFF
				&& (bytes[1] & 0xFF) == 0xD8
				&& (bytes[2] & 0xFF) == 0xFF) {
			return true;
		}
		if ((bytes[0] & 0xFF) == 0x89
				&& (bytes[1] & 0xFF) == 0x50
				&& (bytes[2] & 0xFF) == 0x4E
				&& (bytes[3] & 0xFF) == 0x47
				&& (bytes[4] & 0xFF) == 0x0D
				&& (bytes[5] & 0xFF) == 0x0A
				&& (bytes[6] & 0xFF) == 0x1A
				&& (bytes[7] & 0xFF) == 0x0A) {
			return true;
		}
		return false;
	}

	private synchronized FaceDetection detectFaces(Mat input) {
		detector.setInputSize(new Size(input.cols(), input.rows()));
		Mat faces = new Mat();
		detector.detect(input, faces);
		int count = faces.rows();
		double imageArea = (double) input.cols() * input.rows();

		// 가장 큰 얼굴 1건만 추출해 후속 분석에 사용 (faceCount > 1 이면 이미 거부됨)
		int bestIdx = -1;
		double bestArea = 0;
		for (int i = 0; i < count; i++) {
			double w = faces.get(i, 2)[0];
			double h = faces.get(i, 3)[0];
			double a = w * h;
			if (a > bestArea) {
				bestArea = a;
				bestIdx = i;
			}
		}

		if (bestIdx < 0) {
			return new FaceDetection(0, 0, null, null, null, null, null, null);
		}

		double x = faces.get(bestIdx, 0)[0];
		double y = faces.get(bestIdx, 1)[0];
		double w = faces.get(bestIdx, 2)[0];
		double h = faces.get(bestIdx, 3)[0];
		// YuNet 5점 랜드마크: rightEye, leftEye, nose, rightMouth, leftMouth
		// (사진 보는 사람 기준이 아니라 본인 기준 좌우)
		double[] rightEye = { faces.get(bestIdx, 4)[0], faces.get(bestIdx, 5)[0] };
		double[] leftEye = { faces.get(bestIdx, 6)[0], faces.get(bestIdx, 7)[0] };
		double[] nose = { faces.get(bestIdx, 8)[0], faces.get(bestIdx, 9)[0] };
		double[] rightMouth = { faces.get(bestIdx, 10)[0], faces.get(bestIdx, 11)[0] };
		double[] leftMouth = { faces.get(bestIdx, 12)[0], faces.get(bestIdx, 13)[0] };

		Rect bbox = new Rect((int) x, (int) y, (int) w, (int) h);
		return new FaceDetection(
			count, bestArea / imageArea, bbox, rightEye, leftEye, nose, rightMouth, leftMouth
		);
	}

	private Mat resizeForDetection(Mat image) {
		int maxDim = 640;
		if (image.cols() <= maxDim && image.rows() <= maxDim) return image;
		double scale = Math.min((double) maxDim / image.cols(), (double) maxDim / image.rows());
		Mat resized = new Mat();
		Imgproc.resize(image, resized, new Size((int)(image.cols() * scale), (int)(image.rows() * scale)));
		return resized;
	}

	private double calculateBrightness(Mat image) {
		Mat gray = new Mat();
		Imgproc.cvtColor(image, gray, Imgproc.COLOR_BGR2GRAY);
		Scalar mean = Core.mean(gray);
		return mean.val[0];
	}

	/** Laplacian variance — 값이 작을수록 흐림. 일반적으로 100 이상이 선명, 50 이하 흐림. */
	private double calculateBlurVariance(Mat image, Rect faceRect) {
		Mat face = new Mat(image, faceRect);
		Mat gray = new Mat();
		Imgproc.cvtColor(face, gray, Imgproc.COLOR_BGR2GRAY);
		Mat lap = new Mat();
		Imgproc.Laplacian(gray, lap, CvType.CV_64F);
		MatOfDouble mean = new MatOfDouble();
		MatOfDouble stddev = new MatOfDouble();
		Core.meanStdDev(lap, mean, stddev);
		double s = stddev.toArray()[0];
		return s * s;
	}

	/**
	 * Yaw 추정 — 두 눈 중점과 코의 수평 거리 / 얼굴 너비.
	 * 정면이면 코가 두 눈 중점에 가까우므로 값이 작다.
	 */
	private double calculateYawRatio(FaceDetection f) {
		double eyeMidX = (f.rightEye[0] + f.leftEye[0]) / 2.0;
		double dx = Math.abs(f.nose[0] - eyeMidX);
		return dx / Math.max(1, f.bbox.width);
	}

	/**
	 * Pitch 추정 — (눈->코 거리) / (코->입 거리). 정면이면 약 1.0 근처.
	 * 위를 보면 코가 눈에 가까워 비율 작아짐, 아래 보면 반대.
	 */
	private double calculatePitchRatio(FaceDetection f) {
		double eyeMidY = (f.rightEye[1] + f.leftEye[1]) / 2.0;
		double mouthMidY = (f.rightMouth[1] + f.leftMouth[1]) / 2.0;
		double eyeToNose = Math.abs(f.nose[1] - eyeMidY);
		double noseToMouth = Math.abs(mouthMidY - f.nose[1]);
		if (noseToMouth < 1) return 1.0;
		return eyeToNose / noseToMouth;
	}

	/**
	 * 역광 점수 — 얼굴 영역 평균 밝기 / 배경 평균 밝기.
	 * 1.0 근처면 균일, 0.5 이하면 역광(얼굴이 배경보다 훨씬 어두움).
	 */
	private double calculateBacklightRatio(Mat image, Rect faceRect) {
		Mat gray = new Mat();
		Imgproc.cvtColor(image, gray, Imgproc.COLOR_BGR2GRAY);

		Mat faceGray = new Mat(gray, faceRect);
		double faceMean = Core.mean(faceGray).val[0];

		double totalSum = Core.sumElems(gray).val[0];
		double faceSum = Core.sumElems(faceGray).val[0];
		double bgArea = (gray.rows() * gray.cols()) - (faceRect.width * faceRect.height);
		if (bgArea <= 0) return 1.0;
		double bgMean = (totalSum - faceSum) / bgArea;
		if (bgMean < 1) return 1.0;
		return faceMean / bgMean;
	}

	/** 얼굴 ROI 의 HSV S 채널 평균. 흑백/필터 떡칠 검출. */
	private double calculateFaceSaturation(Mat image, Rect faceRect) {
		Mat face = new Mat(image, faceRect);
		Mat hsv = new Mat();
		Imgproc.cvtColor(face, hsv, Imgproc.COLOR_BGR2HSV);
		Scalar mean = Core.mean(hsv);
		return mean.val[1];
	}

	private Rect clampRect(Rect r, Mat image) {
		int x = Math.max(0, r.x);
		int y = Math.max(0, r.y);
		int w = Math.min(r.width, image.cols() - x);
		int h = Math.min(r.height, image.rows() - y);
		if (w <= 0 || h <= 0) return new Rect(0, 0, 1, 1);
		return new Rect(x, y, w, h);
	}

	private Path copyResourceToTempFile(Resource resource) throws IOException {
		Path tempFile = Files.createTempFile("stylefit-yunet-", ".onnx");
		tempFile.toFile().deleteOnExit();

		try (InputStream inputStream = resource.getInputStream()) {
			Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
		}

		return tempFile;
	}

	private record FaceDetection(
		int faceCount,
		double areaRatio,
		Rect bbox,
		double[] rightEye,
		double[] leftEye,
		double[] nose,
		double[] rightMouth,
		double[] leftMouth
	) {
	}
}
