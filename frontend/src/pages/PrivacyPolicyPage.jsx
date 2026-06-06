import { useNavigate } from 'react-router-dom'
import AccordionSection from '../components/AccordionSection'
import './LegalPage.css'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="lg-frame">
      <header className="lg-topnav">
        <button className="lg-back" type="button" onClick={() => navigate(-1)} aria-label="뒤로가기">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="lg-lg">StyleFit</div>
        <div className="lg-placeholder" />
      </header>

      <div className="lg-hero">
        <span className="lg-pill">Privacy Policy</span>
        <h1 className="lg-title">개인정보 처리방침</h1>
      </div>

      <main className="lg-body">
        <p className="lg-intro">
          <strong>StyleFit</strong>(이하 "서비스")은 무료 프로토타입 형태의 AI 퍼스널 컬러·스타일 진단 서비스입니다.
          서비스는 이용자가 업로드한 사진을 분석하여 퍼스널 컬러, 얼굴형 기반 스타일 추천, 코디 추천 결과를 제공합니다.
        </p>
        <p className="lg-intro">
          본 개인정보 처리방침은 서비스가 어떤 개인정보를 수집하고, 어떻게 이용하며, 언제 삭제하는지 안내하기 위한 문서입니다.
        </p>

        <div className="lg-meta-card">
          <div className="lg-meta-row"><span>운영자</span><span>옥종훈</span></div>
          <div className="lg-meta-row"><span>문의</span><span>style-fit@lu-bello.com</span></div>
        </div>

        <div className="lg-accordion">
          <AccordionSection num="1" title="수집하는 개인정보">
            <p className="lg-p">서비스는 아래 개인정보를 수집할 수 있습니다.</p>
            <div className="lg-table-wrap">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>수집 항목</th>
                    <th>이용 목적</th>
                    <th>보유 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>얼굴 사진</td>
                    <td>이용자가 업로드한 정면 사진</td>
                    <td>AI 퍼스널 컬러·스타일 분석</td>
                    <td>분석 완료 후 즉시 삭제. 단, 오류 확인 및 재처리를 위해 필요한 경우 최대 7일 보관</td>
                  </tr>
                  <tr>
                    <td>AI 분석 데이터</td>
                    <td>퍼스널 컬러 유형, 얼굴톤·얼굴형 분석값, 추천 컬러·헤어·코디 결과, 리포트 내용</td>
                    <td>분석 결과 제공, 리포트 재열람, 서비스 개선</td>
                    <td>생성일로부터 최대 30일</td>
                  </tr>
                  <tr>
                    <td>서비스 이용 기록</td>
                    <td>접속 일시, IP, 브라우저 정보, 기기 정보, 오류 로그</td>
                    <td>보안, 오류 확인, 서비스 품질 개선</td>
                    <td>최대 3개월</td>
                  </tr>
                  <tr>
                    <td>문의 정보</td>
                    <td>이용자가 문의 시 제공한 이메일 주소 및 문의 내용</td>
                    <td>문의 응대</td>
                    <td>문의 처리 완료 후 최대 6개월</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="lg-p">서비스는 현재 무료 프로토타입으로 운영되며, 결제 정보는 수집하지 않습니다.</p>
          </AccordionSection>

          <AccordionSection num="2" title="개인정보의 이용 목적">
            <p className="lg-p">서비스는 수집한 개인정보를 다음 목적에만 이용합니다.</p>
            <ol className="lg-ol">
              <li>이용자가 업로드한 사진을 기반으로 AI 스타일 분석 결과 제공</li>
              <li>분석 결과 리포트 생성 및 재열람 제공</li>
              <li>서비스 오류 확인 및 품질 개선</li>
              <li>이용자 문의 응대</li>
              <li>보안 사고 예방 및 비정상 이용 방지</li>
            </ol>
            <p className="lg-p lg-notice">
              서비스는 이용자의 얼굴 사진을 본인 확인, 신원 확인, 출입·인증, 얼굴 비교, 생체인식정보 생성 목적으로 사용하지 않습니다.
            </p>
          </AccordionSection>

          <AccordionSection num="3" title="AI 분석 및 자동화된 결과 생성">
            <p className="lg-p">서비스는 이용자가 업로드한 사진을 AI 모델에 입력하여 퍼스널 컬러 및 스타일 추천 결과를 자동으로 생성합니다.</p>
            <p className="lg-p">AI 분석 결과는 패션·스타일 참고용 정보이며, 의학적·전문적 진단이나 이용자의 법적 권리·의무에 영향을 미치는 판단이 아닙니다.</p>
            <p className="lg-p">AI 분석 결과는 촬영 환경, 조명, 화질, 각도, 메이크업, 보정 여부 등에 따라 실제와 다를 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="4" title="개인정보의 보유 및 삭제">
            <p className="lg-p">서비스는 개인정보의 이용 목적이 달성되면 지체 없이 해당 정보를 삭제합니다.</p>
            <ul className="lg-ul">
              <li><strong>얼굴 사진 원본:</strong> 분석 완료 후 즉시 삭제합니다. 단, 분석 실패·오류 확인·재처리를 위해 필요한 경우 최대 7일 이내 삭제합니다.</li>
              <li><strong>AI 분석 데이터 및 리포트:</strong> 생성일로부터 최대 30일 보관 후 삭제합니다.</li>
              <li><strong>서비스 이용 기록:</strong> 보안 및 오류 확인 목적상 최대 3개월 보관 후 삭제합니다.</li>
              <li><strong>문의 정보:</strong> 문의 처리 완료 후 최대 6개월 보관 후 삭제합니다.</li>
            </ul>
            <p className="lg-p">전자적 파일은 복구가 어려운 방식으로 삭제합니다.</p>
          </AccordionSection>

          <AccordionSection num="5" title="개인정보의 제3자 제공">
            <p className="lg-p">서비스는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.</p>
            <p className="lg-p">다만, 다음의 경우에는 예외적으로 제공될 수 있습니다.</p>
            <ol className="lg-ol">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 따라 요구되는 경우</li>
              <li>수사기관 등 공공기관이 법령상 절차에 따라 요청하는 경우</li>
            </ol>
          </AccordionSection>

          <AccordionSection num="6" title="개인정보 처리 위탁 및 국외 이전">
            <p className="lg-p">서비스는 AI 분석 기능 제공을 위해 외부 AI API 또는 클라우드 서비스를 사용할 수 있습니다.</p>
            <div className="lg-table-wrap">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>수탁자</th>
                    <th>처리 업무</th>
                    <th>이전 또는 처리되는 정보</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Anthropic 등 AI API 제공업체</td>
                    <td>이미지 분석 및 텍스트 리포트 생성</td>
                    <td>업로드 이미지, 분석 요청 정보, AI 분석 결과</td>
                  </tr>
                  <tr>
                    <td>클라우드 서비스 제공업체</td>
                    <td>이미지 임시 저장, 서버 운영</td>
                    <td>업로드 이미지, 분석 데이터, 서비스 이용 기록</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="lg-p">외부 AI API를 이용하는 경우, 이용자가 업로드한 사진과 분석 요청 정보가 국외 사업자의 서버로 전송될 수 있습니다. 서비스는 가능한 범위에서 외부 AI API 제공업체가 해당 데이터를 모델 학습에 사용하지 않도록 설정하거나, 이에 준하는 보호 조치를 적용합니다.</p>
            <p className="lg-p">국외 이전을 원하지 않는 경우 서비스를 이용하지 않을 수 있습니다. 다만 이 경우 AI 분석 기능 제공이 제한됩니다.</p>
          </AccordionSection>

          <AccordionSection num="7" title="모델 학습 및 광고 목적 사용 여부">
            <p className="lg-p">서비스는 이용자가 업로드한 얼굴 사진 원본을 운영자의 별도 AI 모델 학습, 광고 타기팅, 제3자 판매 목적으로 사용하지 않습니다.</p>
            <p className="lg-p">서비스 품질 개선을 위해 통계 분석이 필요한 경우, 특정 개인을 알아볼 수 없도록 익명화하거나 통계화한 정보만 사용합니다.</p>
            <p className="lg-p">얼굴 사진 원본을 모델 학습 또는 홍보 목적으로 사용해야 하는 경우에는 별도의 동의를 받습니다.</p>
          </AccordionSection>

          <AccordionSection num="8" title="쿠키 및 분석 도구">
            <p className="lg-p">서비스는 접속 통계와 품질 개선을 위해 쿠키 또는 웹 분석 도구를 사용할 수 있습니다.</p>
            <p className="lg-p">수집될 수 있는 정보는 방문 페이지, 체류 시간, 클릭 이벤트, 브라우저 정보, 기기 정보 등입니다.</p>
            <p className="lg-p">서비스는 웹 분석 도구에 얼굴 사진, 전화번호, 이메일 주소, 리포트 접근 토큰 등 개인을 직접 식별할 수 있는 정보를 전송하지 않도록 노력합니다.</p>
            <p className="lg-p">이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 단, 쿠키 저장을 거부할 경우 일부 기능 이용이 제한될 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="9" title="개인정보 보호 조치">
            <p className="lg-p">서비스는 개인정보 보호를 위해 다음과 같은 조치를 적용합니다.</p>
            <ol className="lg-ol">
              <li>서비스 통신 구간 HTTPS 적용</li>
              <li>업로드 이미지 접근 권한 제한</li>
              <li>리포트 접근 링크에 예측하기 어려운 토큰 사용</li>
              <li>원본 사진 자동 삭제 처리</li>
              <li>운영자 및 개발자의 접근 권한 최소화</li>
              <li>오류 및 접근 로그 점검</li>
            </ol>
          </AccordionSection>

          <AccordionSection num="10" title="이용자의 권리">
            <p className="lg-p">이용자는 언제든지 다음 사항을 요청할 수 있습니다.</p>
            <ol className="lg-ol">
              <li>개인정보 열람</li>
              <li>개인정보 정정</li>
              <li>개인정보 삭제</li>
              <li>개인정보 처리 정지</li>
              <li>업로드 사진 및 분석 결과 삭제</li>
            </ol>
            <p className="lg-p">요청은 아래 문의처로 보내주시면 확인 후 합리적인 기간 내에 처리합니다.</p>
            <div className="lg-contact-card">
              <span className="lg-contact-label">문의</span>
              <span className="lg-contact-value">style-fit@lu-bello.com</span>
            </div>
          </AccordionSection>

          <AccordionSection num="11" title="만 14세 미만 이용 제한">
            <p className="lg-p">서비스는 만 14세 미만 아동을 대상으로 하지 않습니다.</p>
            <p className="lg-p">만 14세 미만 아동의 개인정보가 수집된 사실을 확인한 경우, 서비스는 해당 정보를 지체 없이 삭제합니다.</p>
          </AccordionSection>

          <AccordionSection num="12" title="개인정보 보호 담당자">
            <div className="lg-meta-card">
              <div className="lg-meta-row"><span>담당자</span><span>옥종훈</span></div>
              <div className="lg-meta-row"><span>이메일</span><span>style-fit@lu-bello.com</span></div>
              <div className="lg-meta-row"><span>처리 기간</span><span>문의 접수 후 가능한 한 빠르게 처리</span></div>
            </div>
          </AccordionSection>

          <AccordionSection num="13" title="처리방침 변경">
            <p className="lg-p">본 개인정보 처리방침이 변경되는 경우, 서비스 화면 또는 공지사항을 통해 안내합니다.</p>
            <p className="lg-p">변경된 처리방침은 공지한 시행일부터 적용됩니다.</p>
          </AccordionSection>
        </div>
      </main>

      <footer className="lg-footer">
        <button className="lg-footer-back" type="button" onClick={() => navigate(-1)}>
          ← 홈으로 돌아가기
        </button>
        <p className="lg-footer-effective">시행일: 2026년 〇월 〇일</p>
        <p>© 2026 StyleFit</p>
      </footer>
    </div>
  )
}
