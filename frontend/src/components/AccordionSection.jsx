import { useState, useRef } from 'react'
import './AccordionSection.css'

/**
 * @param {{ num: number|string, title: string, children: React.ReactNode, defaultOpen?: boolean }} props
 */
export default function AccordionSection({ num, title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef(null)

  const toggle = () => setIsOpen(prev => !prev)

  return (
    <section className={`ac-section${isOpen ? ' ac-section--open' : ''}`}>
      <button
        type="button"
        className="ac-header"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <span className="ac-header-left">
          <span className="ac-num">{num}</span>
          <span className="ac-title">{title}</span>
        </span>
        <span className="ac-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div
        ref={contentRef}
        className="ac-body"
        style={{ maxHeight: isOpen ? contentRef.current?.scrollHeight + 'px' : '0px' }}
      >
        <div className="ac-body-inner">
          {children}
        </div>
      </div>
    </section>
  )
}
