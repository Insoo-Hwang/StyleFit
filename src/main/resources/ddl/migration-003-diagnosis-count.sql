-- 기존 운영 DB에 diagnosis_count 컬럼 추가 (인당 누적 진단 횟수 한도용)
-- 결과 삭제(soft reset) 시에도 보존되어 삭제→재진단으로 인당 한도(기본 5회)를 우회할 수 없게 한다.
-- 이미 진단을 받은 기존 사용자는 0부터 시작한다(과거 진단은 카운트에 미반영).
ALTER TABLE analysis_result ADD COLUMN IF NOT EXISTS diagnosis_count INTEGER NOT NULL DEFAULT 0;
