package com.stylefit.config;

import com.stylefit.admin.AdminAuthInterceptor;
import com.stylefit.ban.BanGuardInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final BanGuardInterceptor banGuardInterceptor;
    private final AdminAuthInterceptor adminAuthInterceptor;

    @Value("${stylefit.report.storage-dir}")
    private String reportStorageDir;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 분석 모듈 API 전체를 차단 목록 기준으로 가드. /api/ban/** 은 자기 자신 호출이라 제외.
        // 리포트 생성 일일 한도는 AnalysisService 내부에서 AI 모듈 호출 직전에 소모 —
        // DB 캐시 재사용/검증 실패 케이스는 카운트가 빠지지 않게 하기 위함.
        registry.addInterceptor(banGuardInterceptor)
                .addPathPatterns("/api/analysis/**")
                .order(0);

        // 어드민 API — login/logout 외 모든 요청에 세션 쿠키 검증.
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/admin/**")
                .order(1);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 저장된 리포트 이미지를 정적 리소스로 노출.
        // ResourceHandler 의 addResourceLocations 는 file: URI 슬래시로 끝나야 한다.
        String location = Paths.get(reportStorageDir).toAbsolutePath().toUri().toString();
        registry.addResourceHandler("/report-images/**")
                .addResourceLocations(location);
    }
}
