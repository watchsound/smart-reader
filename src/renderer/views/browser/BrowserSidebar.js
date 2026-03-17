/* eslint-disable prettier/prettier */
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Slide } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NotesIcon from '@mui/icons-material/StickyNote2';
import HistoryIcon from '@mui/icons-material/History';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';

import SmallButton from '../../components/Button/SmallButton';
import NoteUI from '../../components/note/NoteUI';
import HistoriesUI from './HistoriesUI';
import InContextChatPanel from '../../components/chat/InContextChatPanel';
import './browser.styles.css';

function BrowserSidebar({
  open,
  onToggle,
  notes,
  onSearchInPage,
  historyFilterKey,
  setHistoryFilterKey,
  onHistorySelect,
  articleStr,
  curBook,
  onAddNote,
  onChatPanelRef,
  activeTab: externalActiveTab,
  onActiveTabChange,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Use external tab state if provided, otherwise use internal state
  const [internalActiveTab, setInternalActiveTab] = useState('notes');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = onActiveTabChange || setInternalActiveTab;
  const [searchText, setSearchText] = useState('');
  const tabsRef = useRef({});
  const indicatorRef = useRef(null);

  const tabs = [
    { id: 'notes', label: 'Notes', icon: NotesIcon, count: notes?.length || 0 },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'ai', label: 'AI Bot', icon: SmartToyIcon },
  ];

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabEl = tabsRef.current[activeTab];
    const indicator = indicatorRef.current;

    if (activeTabEl && indicator) {
      const { offsetLeft, offsetWidth } = activeTabEl;
      indicator.style.left = `${offsetLeft}px`;
      indicator.style.width = `${offsetWidth}px`;
    }
  }, [activeTab]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchText(value);

    if (activeTab === 'notes') {
      onSearchInPage(value);
    } else if (activeTab === 'history') {
      setHistoryFilterKey(value);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      if (activeTab === 'notes') {
        onSearchInPage(searchText);
      }
    }
  };

  const toggleButtonStyle = {
    position: 'absolute',
    top: '50%',
    left: open ? '-28px' : '-28px',
    transform: 'translateY(-50%) rotate(-90deg)',
    transformOrigin: 'center center',
    backgroundColor: isDark ? '#2a2d31' : '#f8f8f8',
    color: isDark ? '#e8e8e8' : '#1d1c1d',
    height: '24px',
    padding: '0 8px',
    zIndex: 1000,
    borderRadius: '4px 4px 0 0',
    fontSize: '11px',
    fontWeight: 500,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
    borderBottom: 'none',
    boxShadow: '0 -2px 4px rgba(0,0,0,0.05)',
  };

  const sidebarContent = (
    <div className={`browser-sidebar ${isDark ? 'browser-sidebar--dark' : ''}`}>
      {/* Tab Bar */}
      <div className="browser-tab-bar">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <div
              key={tab.id}
              ref={(el) => { tabsRef.current[tab.id] = el; }}
              className={`browser-tab ${activeTab === tab.id ? 'browser-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComponent sx={{ fontSize: 16 }} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="browser-tab-badge">{tab.count}</span>
              )}
            </div>
          );
        })}
        <div ref={indicatorRef} className="browser-tab-indicator" />
      </div>

      {/* Tab Content */}
      <div className="browser-tab-content">
        {/* Search Row (for Notes and History tabs) */}
        {(activeTab === 'notes' || activeTab === 'history') && (
          <div className="browser-search-row">
            <div className="browser-search-input">
              <SearchIcon sx={{ fontSize: 18, opacity: 0.5 }} />
              <input
                type="text"
                placeholder={activeTab === 'notes' ? 'Search in page...' : 'Search history...'}
                value={activeTab === 'history' ? historyFilterKey : searchText}
                onChange={handleSearchChange}
                onKeyDown={handleSearchSubmit}
              />
            </div>
          </div>
        )}

        {/* Notes Panel */}
        {activeTab === 'notes' && (
          <div className="browser-scroll-container" style={{ position: 'relative' }}>
            {notes && notes.length > 0 ? (
              <div className="notes-panel">
                {notes.map((note) => (
                  <NoteUI
                    key={note.id}
                    selectedNoteKey={note.id}
                    selectHandler={() => {}}
                    showQuizHandler={() => {}}
                    customAction={() => {}}
                    customActionName=""
                    cardWidth="290"
                    cardHeight="200"
                    compactView
                    useMiniHeight
                  />
                ))}
              </div>
            ) : (
              <div className="notes-empty-state">
                <div className="notes-empty-icon">📝</div>
                <div className="notes-empty-title">No notes yet</div>
                <div className="notes-empty-subtitle">
                  Capture a section of the page to create a note
                </div>
              </div>
            )}

            {/* Floating Add Button */}
            <div className="notes-add-btn" onClick={onAddNote}>
              <AddIcon />
            </div>
          </div>
        )}

        {/* History Panel */}
        {activeTab === 'history' && (
          <div className="browser-scroll-container">
            <HistoriesUI
              filterKey={historyFilterKey}
              historyCallback={onHistorySelect}
            />
          </div>
        )}

        {/* AI Chat Panel */}
        {activeTab === 'ai' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <InContextChatPanel articleStr={articleStr} curBook={curBook} onRef={onChatPanelRef} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <SmallButton style={toggleButtonStyle} onClick={onToggle}>
        {open ? 'Hide Panel' : 'Show Panel'}
      </SmallButton>

      <Slide direction="left" in={open} mountOnEnter unmountOnExit>
        {sidebarContent}
      </Slide>
    </div>
  );
}

export default BrowserSidebar;
