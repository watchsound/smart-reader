/* eslint-disable prettier/prettier */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge as updateEdge,
  Position,
} from '@xyflow/react';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import '@xyflow/react/dist/base.css';
import { styled } from '@mui/material/styles';

import './mindmap.module.css';
import MindmapModal from './MindmapModal';
import './style.css';
import ContextMenu from './ContextMenu';



function MyMindMap({ keywordMap, descriptionMap }) {
  const [open, setOpened] = useState(false);
  const [width, setWidth] = useState(keywordMap.width+30);
  const [height, setHeight] = useState(keywordMap.height+30);
  const [nodes, setNodes, onNodesChange] = useNodesState(keywordMap.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(keywordMap.edges);

    const [menu, setMenu] = useState(null);
  const ref = useRef(null);

  const onConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );
  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const pane = ref.current.getBoundingClientRect();
      setMenu({
        id: node.id,
        top: 10,
        left: 100,
        right: pane.width-200,
        bottom: pane.height-110,
        fullMenu: false,
      });
    },
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);
 //  const onConnect = (params) => setEdges((els) => addEdge(params, els));


  return (
    <>
      <div style={{ width: '100%', height: '100%', minHeight: '120px'}}>
        <ReactFlow
          ref={ref}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          fitView>
          <Background />
          <Controls />
          <MiniMap />
          {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
        </ReactFlow>
      </div>
      <div className="two_end_container">
        <div className="two_end_end" style={{ border: 'none' }}>
          <Tooltip title="Detailed Map">
            <IconButton
              size="small"
              onClick={() => {
                setOpened(true);
              }}
              aria-label="edit"
            >
              <DisplaySettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <MindmapModal
        open={open}
        initialWidth={descriptionMap.width}
        initialHeight={descriptionMap.height}
        initialNodes={descriptionMap.nodes}
        initialEdges={descriptionMap.edges}
        callback = { () => setOpened(false) }
      />
    </>

  );
}

export default MyMindMap;
