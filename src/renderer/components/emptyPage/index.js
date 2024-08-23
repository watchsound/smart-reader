/* eslint-disable prettier/prettier */
import React from 'react';

import { useSelector } from 'react-redux';
import './emptyPage.css';
import emptyPic from '../../../../public/icon.svg'
import emptyLightPic from '../../../../public/cover.svg'
import { emptyList } from '../../constants/emptyList';
import customStorage from '../../store/customStorage';

function EmptyPage( ) {
  const mode = useSelector((state) => state.sidebar.mode);
  const isCollapsed = useSelector((state) => state.sidebar.isCollapsed);
  const renderEmptyList = () => {
    return emptyList.map((item) => {
      return (
        <div
          className="empty-page-info-container"
          key={item.mode}
          style={mode === item.mode ? {} : { visibility: 'hidden' }}
        >
          <div className="empty-page-info-main">{item.main}</div>
          <div className="empty-page-info-sub">{item.sub}</div>
        </div>
      );
    });
  };

  return (
    <div
      className="empty-page-container"
      style={isCollapsed ? { width: 'calc(100vw - 100px)', left: '100px' } : {}}
    >
      <div
        className="empty-illustration-container"
        style={{ width: 'calc(100% - 50px)' }}
      >
        <img
          src={
            customStorage.getReaderConfig('appSkin') === 'night' ||
            (customStorage.getReaderConfig('appSkin') === 'system' &&
              customStorage.getReaderConfig('isOSNight') === 'yes')
              ? emptyLightPic
              : emptyPic
          }
          alt=""
          className="empty-page-illustration"
        />
      </div>
      {renderEmptyList()}
    </div>
  );
}

export default EmptyPage;
