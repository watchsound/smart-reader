/* eslint-disable prettier/prettier */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';

import 'reactflow/dist/base.css';
import './style.css';
import ContextMenu from './ContextMenu';
import SmallButton from '../Button/SmallButton';
import openImpressWindow from '../impressjs';

function MindmapModal({
  open,
  initialWidth,
  initialHeight,
  initialNodes,
  initialEdges,
  callback,
}: {
  open: boolean;
  initialWidth: number;
  initialHeight: number;
  initialNodes: object[];
  initialEdges: object[];
  callback: () => {};
}) {
  const [opened, setOpened] = useState(open);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [menu, setMenu] = useState(null);
  const ref = useRef(null);

  const onConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const openSliderView = () => {
    const sliders: string[] = [];
    nodes.forEach((node, index) => {
      let d = '';
      if (node.data && node.data.detail) d = node.data.detail;
      else if (node.data && node.data.label) d = node.data.label;
      if (d) sliders.push(d);
    });
    if (sliders.length > 0) openImpressWindow({ paragraph : sliders })
  }

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const pane = ref.current.getBoundingClientRect();
      setMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 && event.clientY -200,
        left: event.clientX < pane.width - 200 && event.clientX -200,
        right: event.clientX >= pane.width - 200 && pane.width - event.clientX+200,
        bottom:
          event.clientY >= pane.height - 200 && pane.height - event.clientY+200,
        fullMenu: true,
      });
    },
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  useEffect(() => {
    setOpened(open);
  }, [open]);

  function close() {
    setOpened(false);
    callback();
  }

  return (
    <Dialog
      open={opened}
      onClose={() => close( )}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">View MindMap</DialogTitle>
      <DialogContent>
        <div
          style={{
            width: initialWidth,
            height: initialHeight,
            maxHeight: '520px',
            maxWidth: '520px',
          }}
        >
          <ReactFlow
            ref={ref}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
            {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
          </ReactFlow>
        </div>
      </DialogContent>
      <DialogActions>
        <SmallButton variant="contained" onClick={() => openSliderView( )} autoFocus>
          Slider View
        </SmallButton>
        <SmallButton variant="contained" onClick={() => close( )} autoFocus>
          Close
        </SmallButton>
      </DialogActions>
    </Dialog>
  );
}

export default MindmapModal;
