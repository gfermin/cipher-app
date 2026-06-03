'use client'
import { useState } from 'react'
import { AddContactSheet } from './AddContactSheet'
import { RequestInbox } from './RequestInbox'

interface Props {
  onBack?: () => void
}

export function ContactsView({ onBack }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="contacts-screen">
      <div className="contacts-header">
        {onBack && (
          <button className="mobile-back-btn" style={{ display: 'flex' }} onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        <span className="contacts-header-title">Contacts</span>
        <button
          className="sidebar-icon-btn"
          onClick={() => setSheetOpen(true)}
          title="Add Contact"
          aria-label="Add Contact"
          style={{ color: 'var(--accent-light)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </button>
      </div>

      <div className="contacts-content">
        <div className="contacts-section">
          <div className="contacts-section-title">Pending Requests</div>
          <RequestInbox />
        </div>
      </div>

      {sheetOpen && <AddContactSheet onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
