package com.stylefit.vision;

import java.io.IOException;
import java.util.List;

import org.opencv.core.Mat;
import org.opencv.core.MatOfByte;
import org.opencv.core.Size;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PhotoValidationService {

	public PhotoValidationService() {
		nu.pattern.OpenCV.loadLocally();
	}

	public PhotoValidationResponse validate(MultipartFile file) throws IOException {
		if (file.isEmpty()) {
			return new PhotoValidationResponse(false, List.of("사진 파일을 첨부해주세요."));
		}

		byte[] bytes = file.getBytes();
		if (!isAcceptableImageMagic(bytes)) {
			return new PhotoValidationResponse(false,
				List.of("지원되지 않는 이미지 형식입니다. JPG 또는 PNG 파일만 업로드해주세요."));
		}

		Mat image = decodeImage(bytes);
		if (image.empty()) {
			return new PhotoValidationResponse(false, List.of("이미지 파일을 읽을 수 없습니다."));
		}

		resize(image);
		return new PhotoValidationResponse(true, List.of());
	}

	private Mat decodeImage(byte[] bytes) {
		MatOfByte buf = new MatOfByte(bytes);
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

	private Mat resize(Mat image) {
		int maxDim = 640;
		if (image.cols() <= maxDim && image.rows() <= maxDim) return image;
		double scale = Math.min((double) maxDim / image.cols(), (double) maxDim / image.rows());
		Mat resized = new Mat();
		Imgproc.resize(image, resized, new Size((int)(image.cols() * scale), (int)(image.rows() * scale)));
		return resized;
	}
}
