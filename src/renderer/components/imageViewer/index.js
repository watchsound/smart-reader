/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './imageViewer.css';

import FileSaver from 'file-saver';
import { handleLinkJump } from '../../../commons/utils/content/linkUtil';
import { getIframeDoc } from '../../utils/docUtil';

function ImageViewer({ rendition }) {
  const [state, setState] = useState({
    isShowImage: false,
    imageRatio: 'horizontal',
    zoomIndex: 0,
    rotateIndex: 0,
  });

  useEffect(() => {
    rendition.on('rendered', () => {
      const doc = getIframeDoc();
      if (!doc) return;
      // StyleUtil.addDefaultCss();
      doc.addEventListener('click', showImage);
    });
  }, [rendition]);

  async function showImage(event) {
    event.preventDefault();
    // if (props.isShow) {
    //   props.handleLeaveReader('left');
    //   props.handleLeaveReader('right');
    //   props.handleLeaveReader('top');
    //    props.handleLeaveReader('bottom');
    //  }
    await handleLinkJump(event, rendition);
    if (
      !event.target.src ||
      event.target.href ||
      event.target.parentNode.href ||
      event.target.parentNode.parentNode.href
    ) {
      return;
    }
    if (state.isShowImage) {
      setState({
        isShowImage: false,
        zoomIndex: 0,
        rotateIndex: 0,
        imageRatio: 'horizontal',
      });
    }
    event.preventDefault();
    const handleDirection = (direction) => {
      setState({ ...state, imageRatio: direction });
    };
    const img = new Image();
    img.addEventListener('load', function () {
      handleDirection(
        this.naturalWidth / this.naturalHeight > 1 ? 'horizontal' : 'vertical',
      );
    });
    img.src = event.target.src;
    const image = document.querySelector('.image');
    if (image) {
      image.src = event.target.src;
      setState({ ...state, isShowImage: true });
    }
  }

  function hideImage(event) {
    event.preventDefault();
    if (event.target.src) {
      const image = document.querySelector('.image');
      if (image) image.src = '';
    }
    setState({ ...state, isShowImage: false });
  }

  function handleZoomIn() {
    const image = document.querySelector('.image');
    if (image.style.width === '200vw' || image.style.height === '200vh') return;
    setState(
      (prevState) => ({
        ...prevState,
        zoomIndex: prevState.zoomIndex + 1,
      }),
      () => {
        if (state.imageRatio === 'horizontal') {
          image.style.width = `${60 + state.zoomIndex * 10}vw`;
        } else {
          image.style.height = `${100 + 10 * state.zoomIndex}vh`;
          image.style.marginTop = `${10 * state.zoomIndex}vh`;
        }
      },
    );
  }

  function handleZoomOut() {
    const image = document.querySelector('.image');
    if (image.style.width === '10vw' || image.style.height === '10vh') return;
    setState(
      (prevState) => ({
        ...prevState,
        zoomIndex: prevState.zoomIndex - 1,
      }),
      () => {
        if (state.imageRatio === 'horizontal') {
          image.style.width = `${60 + state.zoomIndex * 10}vw`;
        } else {
          image.style.height = `${100 + 10 * state.zoomIndex}vh`;
        }
      },
    );
  }

  async function handleSave() {
    const image = document.querySelector('.image');
    const blob = await fetch(image.src).then((r) => r.blob());
    FileSaver.saveAs(blob, `${new Date().toLocaleDateString()}`);
  }

  function handleClock() {
    const image = document.querySelector('.image');
    setState(
      (prevState) => ({
        ...prevState,
        rotateIndex: prevState.rotateIndex + 1,
      }),
      () => {
        image.style.transform = `rotate(${state.rotateIndex * 90}deg)`;
      },
    );
  }

  function handleCounterClock() {
    const image = document.querySelector('.image');
    setState(
      (prevState) => ({
        ...prevState,
        rotateIndex: prevState.rotateIndex - 1,
      }),
      () => {
        image.style.transform = `rotate(${state.rotateIndex * 90}deg)`;
      },
    );
  }

  return (
    <div
      className="image-preview"
      style={state.isShowImage ? {} : { display: 'none' }}
    >
      <div
        className="image-background"
        style={
          state.isShowImage ? { backgroundColor: 'rgba(75,75,75,0.3)' } : {}
        }
        onClick={(event) => {
          hideImage(event);
        }}
      />
      <img
        src=""
        alt=""
        className="image"
        style={
          state.imageRatio === 'horizontal'
            ? { width: '60vw' }
            : { height: '100vh' }
        }
      />
      <div className="image-operation">
        <span
          className="icon-zoom-in zoom-in-icon"
          onClick={() => {
            handleZoomIn();
          }}
        />
        <span
          className="icon-zoom-out zoom-out-icon"
          onClick={() => {
            handleZoomOut();
          }}
        />
        <span
          className="icon-save save-icon"
          onClick={() => {
            handleSave();
          }}
        />
        <span
          className="icon-clockwise clockwise-icon"
          onClick={() => {
            handleClock();
          }}
        />
        <span
          className="icon-counterclockwise counterclockwise-icon"
          onClick={() => {
            handleCounterClock();
          }}
        />
      </div>
    </div>
  );
}

export default ImageViewer;
