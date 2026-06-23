/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
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
  lpId,
  onAction,
  customActions,
  ...props
}) {
  const [node, setNode] = useState(null);
  const { getNode, setNodes, addNodes, setEdges } = useReactFlow();
  const dispatch = useDispatch();

  useEffect(() => {
     const n = getNode(id);
     setNode(n);
  }, [id, getNode]);

  // Some callers pass legacy `data.label`; the new canonical form uses
  // `data.text`. Read whichever is present so this menu works for both.
  const nodeText = node
    ? (node.data && (node.data.text ?? node.data.label)) || ''
    : '';
  // Prefer explicit lpId prop; fall back to node.data.learningPointId so the
  // new canonical-shape nodes light up the "Study / Find in graph" entries
  // even when the caller does not bother to pass lpId explicitly.
  const effectiveLpId =
    lpId ?? (node && node.data ? node.data.learningPointId : undefined);

  const duplicateNode = useCallback(() => {
    const position = {
      x: node.position.x + 50,
      y: node.position.y + 50,
    };
    addNodes({ ...node, id: `${node.id}-copy`, position });
  }, [node, addNodes]);

  const copyContent = useCallback(() => {
    if (nodeText) {
      navigator.clipboard.writeText(nodeText);
    }
  }, [nodeText]);

  const search = useCallback(() => {
    if (nodeText) {
      dispatch(filterByKeyHandled(nodeText));
    }
  }, [nodeText, dispatch]);

  const deleteNode = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id));
  }, [id, setNodes, setEdges]);

  const studyConcept = useCallback(() => {
    if (onAction && effectiveLpId) onAction('study', effectiveLpId);
  }, [onAction, effectiveLpId]);

  const findInGraph = useCallback(() => {
    if (onAction && effectiveLpId) onAction('findInGraph', effectiveLpId);
  }, [onAction, effectiveLpId]);

  return (
    <div
      style={{ top, left, right, bottom }}
      className="context-menu"
      {...props}
    >
      <p style={{ margin: '0.2em' }}>
        <small>{nodeText && `${nodeText.substring(0, 10)}...`}</small>
      </p>
      {fullMenu && (<button type="button" onClick={duplicateNode}>Duplicate</button>)}
      {fullMenu && (<button type="button" onClick={deleteNode}>Delete</button>)}
      <button type="button" onClick={copyContent}>{fullMenu ? 'Copy To Clipboard' : 'Copy'}</button>
      <button type="button" onClick={search}>Search</button>
      {effectiveLpId && onAction && (
        <button type="button" onClick={studyConcept}>Study this concept</button>
      )}
      {effectiveLpId && onAction && (
        <button type="button" onClick={findInGraph}>Find in graph</button>
      )}
      {Array.isArray(customActions) && customActions.map((a) => (
        <button type="button" key={a.label} onClick={a.onClick}>{a.label}</button>
      ))}
      <button type="button" onClick={() => { }}>Close</button>
    </div>
  );
}
