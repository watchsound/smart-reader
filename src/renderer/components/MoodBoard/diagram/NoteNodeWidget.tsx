import * as React from 'react';
import {
  DiagramEngine,
  PortModelAlignment,
  PortWidget,
} from '@projectstorm/react-diagrams';
import styled from '@emotion/styled';
import { useSelector, useDispatch } from 'react-redux';
import { styled as styledComp } from 'styled-components';

import { NoteNodeModel } from './NoteNodeModel';
import NoteUI from '../../note/NoteUI';
import { diagramNoteHandled } from '../../../store/reducers/moodBoardSlice';
import DiagramNoteUI from './DiagramNoteUI';
// import NoteDetailModal from '../../note/NoteDetailModal';

export interface NoteNodeWidgetProps {
  node: NoteNodeModel;
  engine: DiagramEngine;
  width?: number;
  height?: number;
}

const S = {
  Port: styled.div`
    width: 8px;
    height: 8px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: rgba(0, 0, 0, 1);
    }
  `,
};

const ResizeHandle = styledComp.div`
  width: 10px;
  height: 10px;
  background-color: red;
  position: absolute;
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
`;

function NoteNodeWidget({ node, engine }) {
  // console.log(' enter NoteNodeWidget ............................. ')
  const [isDragging, setIsDragging] = React.useState(false);
  const [originalSize, setOriginalSize] = React.useState({
    width: 10,
    height: 10,
  });
  const [mouseDownPosition, setMouseDownPosition] = React.useState({
    x: 0,
    y: 0,
  });
  const curEditState = useSelector((state) => state.moodBoard.editState);
  const showControl = useSelector((state) => state.moodBoard.showControl);

  const dispatch = useDispatch();

  React.useEffect(() => {
    if (!node) return;
    setOriginalSize({
      width: node.width || 250,
      height: node.height || 180,
    });
  }, [node]);

  const onMouseDown = (event) => {
    if (!curEditState) {
      event.stopPropagation();
      setIsDragging(false);
      return;
    }
    setIsDragging(true);
    setMouseDownPosition({ x: event.clientX, y: event.clientY });
    // setOriginalSize({ width: node.width || 250, height: node.height || 180 });
    event.stopPropagation();
  };

  const onMouseMove = (event) => {
    if (!curEditState) {
      event.stopPropagation();
      return;
    }
    if (isDragging) {
      const dx = event.clientX - mouseDownPosition.x;
      const dy = event.clientY - mouseDownPosition.y;
      node.setSize(originalSize.width + dx, originalSize.height + dy);
      // setMouseDownPosition({ x: event.clientX, y: event.clientY });
      engine.repaintCanvas();
    }
  };

  const onMouseUp = (event) => {
    if (!curEditState) {
      setIsDragging(false);
      event.stopPropagation();
      return;
    }
    setIsDragging(false);
  };
  React.useEffect(() => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (!curEditState) {
      return;
    }
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [curEditState, isDragging]);

  console.log( ` width = ${node.width} height = ${node.height}`)

  return (
    <div
      className="note-node"
      style={{
        position: 'relative',
        width: node.width || 250,
        height: node.height || 180,
        border: curEditState ? '1px dotted white' : 'none',
      }}
    >
      {node.note && (
        <NoteUI
          key={node.note.id}
          selectedNoteKey={node.note.id}
          selectHandler={() => {}}
          compactView={!showControl}
          useBgColor
          customAction={() => {
            dispatch(diagramNoteHandled(node.note));
          }}
          customActionName="Show Detail"
          deleteAction={() => {
            if (!node.isLocked()) node.remove();
            engine.repaintCanvas();
          }}
          deleteActionName="Remove From Diagram"
          cardWidth={node.width}
          cardHeight={node.height}
          showQuizHandler={undefined}
        />
      )}
      <PortWidget
        style={{
          top: (node.height || 180) / 2 - 8,
          left: -8,
          position: 'absolute',
        }}
        port={node.getPort(PortModelAlignment.LEFT)}
        engine={engine}
      >
        <S.Port />
      </PortWidget>
      <PortWidget
        style={{
          left: (node.width || 250) / 2 - 8,
          top: -8,
          position: 'absolute',
        }}
        port={node.getPort(PortModelAlignment.TOP)}
        engine={engine}
      >
        <S.Port />
      </PortWidget>
      <PortWidget
        style={{
          left: (node.width || 250) - 8,
          top: (node.height || 180) / 2 - 8,
          position: 'absolute',
        }}
        port={node.getPort(PortModelAlignment.RIGHT)}
        engine={engine}
      >
        <S.Port />
      </PortWidget>
      <PortWidget
        style={{
          left: (node.width || 250) / 2 - 8,
          top: (node.height || 180) - 8,
          position: 'absolute',
        }}
        port={node.getPort(PortModelAlignment.BOTTOM)}
        engine={engine}
      >
        <S.Port />
      </PortWidget>
      {curEditState && <ResizeHandle onMouseDown={onMouseDown} />}
    </div>
  );
}

export default NoteNodeWidget;
