-- 기존 운영 DB에 raw_result_json 컬럼 추가
-- 새 분석부터 AI 원본 응답을 저장해 리포트 이미지 생성 API에 전달한다.
-- 기존 행은 NULL로 남으며, 해당 분석은 재업로드 후 새 분석이 필요함.
ALTER TABLE analysis_result ADD COLUMN IF NOT EXISTS raw_result_json TEXT;
