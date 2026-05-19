-- H2(개발용) 부트 시 초기화 스크립트.
-- JPA가 엔티티 테이블을 먼저 만든 뒤(spring.jpa.defer-datasource-initialization=true) 실행된다.
-- JPA 엔티티로 매핑되지 않은 PK-없는 테이블만 여기서 만든다.

CREATE TABLE IF NOT EXISTS banned_user (
    cookie_id   VARCHAR(100),
    ip_address  VARCHAR(45),
    reason      VARCHAR(200),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banned_user_cookie_id  ON banned_user (cookie_id);
CREATE INDEX IF NOT EXISTS idx_banned_user_ip_address ON banned_user (ip_address);
