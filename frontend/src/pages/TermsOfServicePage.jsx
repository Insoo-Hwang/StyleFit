import { useNavigate } from 'react-router-dom'
import AccordionSection from '../components/AccordionSection'
import './LegalPage.css'

export default function TermsOfServicePage() {
  const navigate = useNavigate()

  return (
    <div className="lg-frame">
      <header className="lg-topnav">
        <button className="lg-back" type="button" onClick={() => navigate(-1)} aria-label="뒤로가기">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="lg-lg">STYLE<span className="lg-dot">.</span></div>
        <div className="lg-placeholder" />
      </header>

      <div className="lg-hero">
        <span className="lg-pill">Terms of Service</span>
        <h1 className="lg-title">이용약관</h1>
      </div>

      <main className="lg-body">
        <p className="lg-intro">
          본 이용약관은 <strong>StyleFit</strong>(이하 "서비스")의 무료 프로토타입 이용 조건을 정한 문서입니다.
        </p>
        <p className="lg-intro">
          서비스를 이용하는 경우 본 약관에 동의한 것으로 봅니다.
        </p>

        <div className="lg-meta-card">
          <div className="lg-meta-row"><span>운영자</span><span>〇〇〇</span></div>
          <div className="lg-meta-row"><span>문의</span><span>〇〇〇@〇〇〇.com</span></div>
        </div>

        <div className="lg-accordion">
          <AccordionSection num="1" title="서비스의 목적">
            <p className="lg-p">서비스는 이용자가 업로드한 사진을 기반으로 AI가 퍼스널 컬러, 얼굴형 기반 스타일, 헤어 및 코디 추천 결과를 제공하는 무료 프로토타입 서비스입니다.</p>
            <p className="lg-p">서비스는 정식 상용 서비스가 아니며, 기능 검증과 사용자 반응 확인을 목적으로 운영됩니다.</p>
          </AccordionSection>

          <AccordionSection num="2" title="서비스 이용 방법">
            <p className="lg-p">이용자는 서비스 화면에서 안내하는 방식에 따라 사진을 업로드하고 AI 분석 결과를 확인할 수 있습니다.</p>
            <p className="lg-p">서비스 이용을 위해 회원가입은 필요하지 않습니다.</p>
            <p className="lg-p">운영자는 서비스 개선을 위해 기능, 화면, 분석 방식, 제공 결과의 범위를 변경할 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="3" title="무료 프로토타입 운영">
            <p className="lg-p">서비스는 현재 무료로 제공됩니다.</p>
            <p className="lg-p">운영자는 사전 고지 없이 서비스의 일부 또는 전부를 수정, 중단, 종료할 수 있습니다.</p>
            <p className="lg-p">향후 유료 기능이 도입되는 경우, 결제 조건, 환불 기준, 유료 기능의 범위는 별도 약관 또는 안내 화면을 통해 고지합니다.</p>
          </AccordionSection>

          <AccordionSection num="4" title="AI 분석 결과의 성격">
            <p className="lg-p">서비스가 제공하는 분석 결과는 패션·스타일 참고용 정보입니다.</p>
            <p className="lg-p">분석 결과는 의학적, 과학적, 전문적 진단이 아니며, 실제 퍼스널 컬러 진단 전문가의 판단과 다를 수 있습니다.</p>
            <p className="lg-p">분석 결과는 다음 요소에 따라 달라질 수 있습니다.</p>
            <ol className="lg-ol">
              <li>사진의 조명</li>
              <li>얼굴 각도</li>
              <li>화질</li>
              <li>메이크업 여부</li>
              <li>필터 또는 보정 여부</li>
              <li>배경색</li>
              <li>카메라 성능</li>
            </ol>
            <p className="lg-p lg-notice">
              이용자는 분석 결과를 참고 자료로만 활용해야 하며, 결과의 정확성이나 특정 목적 적합성이 보장되지는 않습니다.
            </p>
          </AccordionSection>

          <AccordionSection num="5" title="이용자의 의무">
            <p className="lg-p">이용자는 서비스를 이용할 때 다음 행위를 해서는 안 됩니다.</p>
            <ol className="lg-ol">
              <li>본인이 이용할 권한이 없는 타인의 사진을 업로드하는 행위</li>
              <li>타인의 개인정보, 초상권, 저작권 등 권리를 침해하는 행위</li>
              <li>불법적이거나 부적절한 이미지를 업로드하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
              <li>자동화된 프로그램 등을 이용해 과도한 요청을 보내는 행위</li>
              <li>서비스 결과를 허위·과장 광고 또는 타인을 기만하는 목적으로 사용하는 행위</li>
            </ol>
            <p className="lg-p">이용자가 위 의무를 위반하여 발생한 문제에 대해서는 이용자가 책임을 부담합니다.</p>
          </AccordionSection>

          <AccordionSection num="6" title="사진 업로드 관련 안내">
            <p className="lg-p">이용자는 본인의 사진 또는 적법하게 이용할 권한이 있는 사진만 업로드해야 합니다.</p>
            <p className="lg-p">서비스는 업로드된 사진을 AI 분석 목적으로만 사용합니다.</p>
            <p className="lg-p">운영자는 불법적이거나 부적절하다고 판단되는 이미지, 타인의 권리를 침해할 가능성이 있는 이미지, 서비스 운영을 방해하는 이미지에 대해 분석을 거부하거나 삭제할 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="7" title="개인정보 보호">
            <p className="lg-p">서비스는 개인정보 처리방침에 따라 이용자의 개인정보를 처리합니다.</p>
            <p className="lg-p">개인정보의 수집 항목, 이용 목적, 보유 기간, 삭제 방법 등은 개인정보 처리방침에서 확인할 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="8" title="지식재산권">
            <p className="lg-p">서비스의 화면, 문구, 디자인, 로고, 코드, 분석 로직 등 서비스 자체에 관한 권리는 운영자 또는 정당한 권리자에게 있습니다.</p>
            <p className="lg-p">이용자가 업로드한 사진에 대한 권리는 이용자 또는 원 권리자에게 있습니다.</p>
            <p className="lg-p">이용자는 서비스 이용에 필요한 범위에서 운영자가 업로드 사진을 일시적으로 처리하는 데 동의합니다.</p>
          </AccordionSection>

          <AccordionSection num="9" title="서비스 중단 및 변경">
            <p className="lg-p">운영자는 다음의 경우 서비스의 전부 또는 일부를 일시 중단하거나 종료할 수 있습니다.</p>
            <ol className="lg-ol">
              <li>서버 점검 또는 장애가 발생한 경우</li>
              <li>외부 API, 클라우드, 네트워크 장애가 발생한 경우</li>
              <li>보안상 필요한 경우</li>
              <li>프로토타입 운영 목적이 종료된 경우</li>
              <li>기타 운영자가 서비스 제공이 어렵다고 판단한 경우</li>
            </ol>
            <p className="lg-p">서비스는 무료 프로토타입이므로, 운영자는 서비스의 지속 제공을 보장하지 않습니다.</p>
          </AccordionSection>

          <AccordionSection num="10" title="책임의 제한">
            <p className="lg-p">서비스는 무료 프로토타입으로 제공되며, 운영자는 관련 법령이 허용하는 범위 내에서 다음 사항에 대해 책임을 지지 않습니다.</p>
            <ol className="lg-ol">
              <li>AI 분석 결과의 정확성, 완전성, 신뢰성</li>
              <li>이용자의 사진 상태 또는 입력 정보에 따라 발생한 결과 차이</li>
              <li>이용자가 분석 결과를 활용하여 한 의사결정</li>
              <li>외부 API, 클라우드, 네트워크 장애로 인한 서비스 이용 제한</li>
              <li>이용자의 귀책 사유로 발생한 개인정보 노출 또는 분쟁</li>
            </ol>
            <p className="lg-p">단, 운영자의 고의 또는 중대한 과실이 있는 경우에는 관련 법령에 따릅니다.</p>
          </AccordionSection>

          <AccordionSection num="11" title="이용 제한">
            <p className="lg-p">운영자는 이용자가 본 약관을 위반하거나 서비스 운영을 방해한다고 판단되는 경우, 해당 이용자의 서비스 이용을 제한할 수 있습니다.</p>
          </AccordionSection>

          <AccordionSection num="12" title="약관의 변경">
            <p className="lg-p">운영자는 필요한 경우 본 약관을 변경할 수 있습니다.</p>
            <p className="lg-p">약관이 변경되는 경우 서비스 화면 또는 공지사항을 통해 안내합니다.</p>
            <p className="lg-p">변경된 약관은 공지한 시행일부터 적용됩니다.</p>
          </AccordionSection>

          <AccordionSection num="13" title="준거법 및 분쟁 해결">
            <p className="lg-p">본 약관은 대한민국 법령에 따라 해석됩니다.</p>
            <p className="lg-p">서비스 이용과 관련하여 분쟁이 발생한 경우, 운영자와 이용자는 성실히 협의하여 해결합니다.</p>
            <p className="lg-p">협의로 해결되지 않는 경우 관할 법원은 관련 법령에 따릅니다.</p>
          </AccordionSection>
        </div>
      </main>

      <footer className="lg-footer">
        <button className="lg-footer-back" type="button" onClick={() => navigate(-1)}>
          ← 홈으로 돌아가기
        </button>
        <p className="lg-footer-effective">시행일: 2026년 〇월 〇일</p>
        <p>© 2026 STYLE — copyright placeholder</p>
      </footer>
    </div>
  )
}
