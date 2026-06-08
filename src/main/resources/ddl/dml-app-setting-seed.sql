-- app_setting 초기값 시드 (운영 설정)
-- ratelimit.report-daily   : 서버 전체 일일 AI 호출 한도 = 100
-- diagnosis.max-per-cookie : 인당(쿠키당) 누적 진단 횟수 한도 = 5
-- 이미 행이 있으면 값만 갱신(idempotent). 어드민에서 값을 바꾼 뒤 다시 실행하면 덮어쓰니 주의.
INSERT INTO app_setting (setting_key, setting_value) VALUES
    ('ratelimit.report-daily',   '100'),
    ('diagnosis.max-per-cookie', '5')
ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value,
        updated_at    = NOW();
