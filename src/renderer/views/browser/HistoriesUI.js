/* eslint-disable no-use-before-define */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Pagination,
  IconButton,
  Tooltip,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import customStorage from '../../store/customStorage';
import './browser.styles.css';

// Generate a color based on domain name
function getDomainColor(domain) {
  const colors = [
    '#1d9bd1', '#2eb67d', '#611f69', '#e01e5a', '#ecb22e',
    '#4a154b', '#36C5F0', '#E9A820', '#DE4E2B', '#6B4FBB',
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

// Format time
function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function HistoryItem({ history, historyCallback, isLast }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const domain = extractDomain(history.sourceKey);
  const domainColor = getDomainColor(domain);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="history-item"
      onClick={() => historyCallback(history.sourceKey)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderLeftColor: isLast ? 'transparent' : undefined,
      }}
    >
      {/* Favicon / Letter Avatar */}
      <div
        className="history-favicon"
        style={{ background: history.favicon ? 'transparent' : domainColor }}
      >
        {history.favicon ? (
          <img src={history.favicon} alt="" />
        ) : (
          <span className="history-favicon-letter">
            {domain.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="history-content">
        <Typography className="history-title" component="div">
          {history.description || domain}
        </Typography>
        <Typography className="history-url">
          {domain}
        </Typography>
      </div>

      {/* Time / Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isHovered ? (
          <>
            <Tooltip title="Open in new tab" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(history.sourceKey, '_blank');
                }}
                sx={{ padding: '4px' }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Typography className="history-time">
            {formatTime(history.createdAt)}
          </Typography>
        )}
      </div>
    </div>
  );
}

function HistoryDateGroup({ date, items, historyCallback }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <div className="history-date-group browser-slide-up">
      {/* Date Header */}
      <div className="history-date-header">
        <CalendarTodayIcon sx={{ fontSize: 14 }} />
        <span>{formatDate(date)}</span>
      </div>

      {/* History Items */}
      <div className="history-items">
        {items.map((history, index) => (
          <HistoryItem
            key={history.id}
            history={history}
            historyCallback={historyCallback}
            isLast={index === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function HistoriesUI({ filterKey, historyCallback }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [histories, setHistories] = useState([]);

  useEffect(() => {
    // Race guard: rapid filterKey/page changes fire overlapping requests.
    // Without this, a slow earlier fetch can resolve after a faster later
    // fetch and overwrite the displayed (correct) results with stale ones.
    let cancelled = false;
    async function fetchHistories() {
      const result = await customStorage.getHistoryByQuery(
        'url',
        filterKey || '',
        page,
        limit,
      );
      if (cancelled) return;

      if (result.data && result.data.length > 0) {
        const groupedByDate = {};

        result.data.forEach((item) => {
          const dateKey = new Date(item.createdAt).toDateString();
          if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
          }
          groupedByDate[dateKey].push(item);
        });

        const groups = Object.entries(groupedByDate).map(([date, items]) => ({
          date,
          items,
        }));

        setHistories(groups);
      } else {
        setHistories([]);
      }

      setTotal(result.total);
    }

    fetchHistories();
    return () => {
      cancelled = true;
    };
  }, [filterKey, page, limit]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  if (histories.length === 0) {
    return (
      <div className="notes-empty-state">
        <div className="notes-empty-icon">🕐</div>
        <div className="notes-empty-title">No history yet</div>
        <div className="notes-empty-subtitle">
          Pages you visit will appear here
        </div>
      </div>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Timeline */}
      <div className="history-timeline" style={{ flex: 1 }}>
        {histories.map((group) => (
          <HistoryDateGroup
            key={group.date}
            date={group.date}
            items={group.items}
            historyCallback={historyCallback}
          />
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            size="small"
            onChange={handlePageChange}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: '12px',
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export default HistoriesUI;
