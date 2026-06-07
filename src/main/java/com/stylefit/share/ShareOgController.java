package com.stylefit.share;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stylefit.analysis.AnalysisResultRepository;
import com.stylefit.analysis.AnalysisStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;

/**
 * /share/{token} 경로에 동적 OG 메타 태그를 주입해 카카오톡·슬랙·네이버 등 크롤러에 미리보기를 제공한다.
 * index.html을 classpath에서 읽어 og:title/description/image/url을 교체 후 반환.
 * 일반 브라우저는 React 앱이 그대로 동작하므로 별도 처리 불필요.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ShareOgController {

    private final ShareTokenRepository shareTokenRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final ObjectMapper objectMapper;

    @Value("${stylefit.base-url:http://www.lu-bello.com:8080}")
    private String baseUrl;

    private static final String DEFAULT_TITLE = "StyleFit — AI 퍼스널컬러 진단";
    private static final String DEFAULT_DESC  = "사진 한 장으로 나만의 퍼스널컬러를 알아보세요. AI가 봄웜·여름쿨·가을웜·겨울쿨 타입을 분석해드립니다.";

    @GetMapping("/share/{token:[^.]+}")
    public ResponseEntity<String> shareOg(@PathVariable String token) {

        // 메타 배열: [title, description, imageUrl, pageUrl]
        String[] meta = {
            DEFAULT_TITLE,
            DEFAULT_DESC,
            baseUrl + "/og-image.png",
            baseUrl + "/share/" + token
        };

        shareTokenRepository.findByToken(token)
            .filter(ShareToken::isActive)
            .flatMap(st -> analysisResultRepository.findById(st.getAnalysisResultId()))
            .filter(ar -> ar.getStatus() == AnalysisStatus.COMPLETED)
            .ifPresent(ar -> {
                String color = extractPersonalColor(ar.getResultJson());
                if (color != null) {
                    meta[0] = color + " 퍼스널컬러 진단 결과 — StyleFit";
                    meta[1] = "AI가 분석한 " + color + " 타입의 컬러·코디 가이드를 확인해보세요.";
                }
                // 리포트 이미지 실연동 전까지는 og-image.png 고정 사용
                // if (ar.getReportImagePath() != null) {
                //     meta[2] = baseUrl + "/report-images/" + ar.getReportImagePath();
                // }
            });

        String html = buildHtml(meta[0], meta[1], meta[2], meta[3]);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .body(html);
    }

    private String buildHtml(String title, String description, String imageUrl, String pageUrl) {
        try {
            ClassPathResource res = new ClassPathResource("static/index.html");
            String html = res.getContentAsString(StandardCharsets.UTF_8);

            html = replaceFirst(html, "<title>[^<]*</title>", "<title>" + escHtml(title) + "</title>");
            html = replaceOg(html, "og:title", escHtml(title));
            html = replaceOg(html, "og:description", escHtml(description));
            html = replaceOg(html, "og:image", imageUrl);
            html = replaceOg(html, "og:url", pageUrl);
            html = replaceMeta(html, "twitter:image", imageUrl);

            return html;
        } catch (IOException e) {
            log.warn("index.html 로딩 실패, fallback OG HTML 반환: {}", e.getMessage());
            return fallbackHtml(title, description, imageUrl, pageUrl);
        }
    }

    /** og:xxx 속성값을 value로 교체 */
    private static String replaceOg(String html, String property, String value) {
        return replaceFirst(html,
                "(<meta property=\"" + property + "\" content=\")[^\"]*(\")(?= */>| *>| />)",
                "$1" + Matcher.quoteReplacement(value) + "$2");
    }

    /** name=xxx 속성값을 value로 교체 (twitter:card 계열) */
    private static String replaceMeta(String html, String name, String value) {
        return replaceFirst(html,
                "(<meta name=\"" + name + "\" content=\")[^\"]*(\")(?= */>| *>| />)",
                "$1" + Matcher.quoteReplacement(value) + "$2");
    }

    private static String replaceFirst(String html, String pattern, String replacement) {
        return html.replaceFirst(pattern, replacement);
    }

    /** index.html을 읽지 못했을 때의 최소 HTML — 봇에게만 보임 */
    private static String fallbackHtml(String title, String description, String imageUrl, String pageUrl) {
        return "<!DOCTYPE html><html lang=\"ko\"><head>" +
               "<meta charset=\"UTF-8\"/>" +
               "<title>" + escHtml(title) + "</title>" +
               "<meta property=\"og:type\" content=\"website\"/>" +
               "<meta property=\"og:title\" content=\"" + escHtml(title) + "\"/>" +
               "<meta property=\"og:description\" content=\"" + escHtml(description) + "\"/>" +
               "<meta property=\"og:image\" content=\"" + imageUrl + "\"/>" +
               "<meta property=\"og:url\" content=\"" + pageUrl + "\"/>" +
               "<meta name=\"twitter:card\" content=\"summary_large_image\"/>" +
               "<meta name=\"twitter:image\" content=\"" + imageUrl + "\"/>" +
               "<meta http-equiv=\"refresh\" content=\"0;url=" + pageUrl + "\"/>" +
               "</head><body></body></html>";
    }

    private String extractPersonalColor(String resultJson) {
        if (resultJson == null) return null;
        try {
            JsonNode root = objectMapper.readTree(resultJson);
            JsonNode node = root.path("personalColor");
            return node.isMissingNode() ? null : node.asText(null);
        } catch (Exception e) {
            return null;
        }
    }

    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
