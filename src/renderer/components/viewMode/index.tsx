/* eslint-disable prettier/prettier */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';

import { useSelector, useDispatch } from 'react-redux';

import { handleFetchList } from '../../store/reducers/managerSlice';

import './viewMode.css';

import customStorage from '../../store/customStorage';

import { viewMode } from '../../constants/viewMode';

function ViewMode( ) {
  // const dispatch = useDispatch();

  const handleChange = (mode) => {
    customStorage.setReaderConfig('viewMode', mode);
    handleFetchList();
  };

  return (
    <div className="book-list-view">
      {viewMode.map((item) => (
        <div
          key={item.mode}
          className="card-list-mode"
          onClick={() => {
            handleChange(item.mode);
          }}
          style={viewMode !== item.mode ? { opacity: 0.5 } : {}}
        >
          <span className={`icon-${item.icon}`} />
        </div>
      ))}
    </div>
  );
}

export default ViewMode;
