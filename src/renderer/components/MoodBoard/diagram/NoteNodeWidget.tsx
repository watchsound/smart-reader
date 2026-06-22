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
  showPorts?: boolean;
}

const S = {
  Port: styled.div`
    width: 10px;
    height: 10px;
    z-index: 10;
    background: rgba(100, 100, 100, 0.6);
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(33, 150, 243, 0.9);
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(33, 150, 243, 0.4);
    }
  `,
};

const ResizeHandle = styledComp.div`
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, transparent 50%, rgba(33, 150, 243, 0.8) 50%);
  position: absolute;
  bottom: 2px;
  right: 2px;
  cursor: nwse-resize;
  border-radius: 0 0 8px 0;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

function NoteNodeWidget({ node, engine, showPorts = false }: NoteNodeWidgetProps) {
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
  const curEditState = useSelector((state: any) => state.moodBoard.editState);
  const showControl = useSelector((state: any) => state.moodBoard.showControl);

  const dispatch = useDispatch();

  React.useEffect(() => {
    if (!node) return;
    setOriginalSize({
      width: node.width || 250,
      height: node.height || 180,
    });
  }, [node]);

  const onMouseDown = (event: React.MouseEvent) => {
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

  const onMouseMove = (event: MouseEvent) => {
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

  const onMouseUp = (event: MouseEvent) => {
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

  // console.log( ` width = ${node.width} height = ${node.height}`)

  return (
    <div
      className="note-node"
      style={{
        position: 'relative',
        width: node.width || 250,
        height: node.height || 180,
        // Selection border - now using outline to avoid layout shift
        outline: curEditState ? '2px dashed rgba(33, 150, 243, 0.7)' : 'none',
        outlineOffset: '2px',
        borderRadius: '12px',
        transition: 'outline 0.2s ease, box-shadow 0.2s ease',
        boxShadow: curEditState
          ? '0 4px 20px rgba(33, 150, 243, 0.2)'
          : '0 2px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {node.note && (
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — NoteUI is a JS component; ts infers required props that are actually optional
        <NoteUI
          key={node.note.id}
          selectedNoteKey={node.note.id}
          selectHandler={() => {}}
          compactView={!showControl}
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
          noPadding
        />
      )}
      {showPorts && (
        <>
          <PortWidget
            style={{
              top: (node.height || 180) / 2 - 5,
              left: -10,
              position: 'absolute',
            }}
            port={node.getPort(PortModelAlignment.LEFT)!}
            engine={engine}
          >
            <S.Port data-testid="note-port" />
          </PortWidget>
          <PortWidget
            style={{
              left: (node.width || 250) / 2 - 5,
              top: -10,
              position: 'absolute',
            }}
            port={node.getPort(PortModelAlignment.TOP)!}
            engine={engine}
          >
            <S.Port data-testid="note-port" />
          </PortWidget>
          <PortWidget
            style={{
              left: (node.width || 250) - 4,
              top: (node.height || 180) / 2 - 5,
              position: 'absolute',
            }}
            port={node.getPort(PortModelAlignment.RIGHT)!}
            engine={engine}
          >
            <S.Port data-testid="note-port" />
          </PortWidget>
          <PortWidget
            style={{
              left: (node.width || 250) / 2 - 5,
              top: (node.height || 180) - 4,
              position: 'absolute',
            }}
            port={node.getPort(PortModelAlignment.BOTTOM)!}
            engine={engine}
          >
            <S.Port data-testid="note-port" />
          </PortWidget>
        </>
      )}
      {curEditState && <ResizeHandle onMouseDown={onMouseDown} />}
    </div>
  );
}

export default NoteNodeWidget;
