/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDispatch } from 'react-redux';
import { filterByKeyHandled } from '../../store/reducers/noteSlice';

export default function ContextMenu({
  id,
  top,
  left,
  right,
  bottom,
  fullMenu,
  ...props
}) {
  const [node, setNode] = useState(null);
  const { getNode, setNodes, addNodes, setEdges } = useReactFlow();
  const dispatch = useDispatch();

  useEffect(() => {
     const n = getNode(id);
     setNode(n);
  }, [id, getNode]);

  const duplicateNode = useCallback(() => {
    // const node = getNode(id);
    const position = {
      x: node.position.x + 50,
      y: node.position.y + 50,
    };

    addNodes({ ...node, id: `${node.id}-copy`, position });
  }, [node, addNodes]);

  const copyContent = useCallback(() => {
    // const node = getNode(id);
    navigator.clipboard.writeText(node.data.label);
  }, [node]);

  const search = useCallback(() => {
    // const node = getNode(id);
     dispatch(filterByKeyHandled(node.data.label))
  }, [node]);

  const deleteNode = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id));
  }, [id, setNodes, setEdges]);

  return (
    <div
      style={{ top, left, right, bottom }}
      className="context-menu"
      {...props}
    >
      <p style={{ margin: '0.2em' }}>
        <small>{node && node.data.label.substring(0,10)}...</small>
      </p>
      {fullMenu && (<button onClick={duplicateNode}>Duplicate</button> )}
      {fullMenu && (<button onClick={deleteNode}>Delete</button>)}
      <button onClick={copyContent}>{fullMenu?'Copy To Clipboard':'Copy'}</button>
      <button onClick={search}>Search</button>
      <button onClick={() => { }}>Close</button>
    </div>
  );
}
