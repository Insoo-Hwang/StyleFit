package com.stylefit.share;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * /og-image.png — OG 기본 미리보기 이미지 (1200×630).
 * Vite 빌드가 static/ 을 비우므로 정적 파일 대신 컨트롤러로 생성.
 * 서버 시작 시 한 번 렌더링하고 메모리에 캐시한다.
 */
@RestController
public class OgImageController {

    private static final byte[] PNG = build();

    @GetMapping(value = "/og-image.png", produces = "image/png")
    public ResponseEntity<byte[]> ogImage() {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(PNG);
    }

    private static byte[] build() {
        try {
            System.setProperty("java.awt.headless", "true");
            int W = 1200, H = 630;
            BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = img.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,      RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING,         RenderingHints.VALUE_RENDER_QUALITY);

            // 배경 — 다크그린
            g.setColor(new Color(0x1d, 0x31, 0x22));
            g.fillRect(0, 0, W, H);

            // 좌측 골드 강조바
            g.setColor(new Color(0xe7, 0xd8, 0xa8));
            g.fillRoundRect(100, 190, 7, 220, 4, 4);

            // 메인 타이틀
            g.setColor(new Color(0xe7, 0xd8, 0xa8));
            g.setFont(new Font("SansSerif", Font.BOLD, 96));
            g.drawString("StyleFit", 128, 330);

            // 서브타이틀
            g.setColor(new Color(0xcc, 0xdd, 0xcc));
            g.setFont(new Font("SansSerif", Font.PLAIN, 44));
            g.drawString("AI Personal Color Diagnosis", 128, 400);

            // 도메인
            g.setColor(new Color(0x77, 0x99, 0x77));
            g.setFont(new Font("SansSerif", Font.PLAIN, 30));
            g.drawString("lu-bello.com", 130, 470);

            // 우측 장식 원
            g.setColor(new Color(0x2a, 0x45, 0x30));
            g.fillOval(800, -100, 600, 600);
            g.setColor(new Color(0x23, 0x3c, 0x28));
            g.fillOval(870, 200, 400, 400);

            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "PNG", out);
            return out.toByteArray();
        } catch (IOException e) {
            return new byte[0];
        }
    }
}
