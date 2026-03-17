/* eslint-disable react/button-has-type */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
import * as React from 'react';
import { useState, useRef } from 'react';
// import Button from '@mui/material/Button';
// import ButtonGroup from '@mui/material/ButtonGroup';
// import Paper from '@mui/material/Paper';
// import EditNoteIcon from '@mui/icons-material/EditNote';
// import BorderColorIcon from '@mui/icons-material/BorderColor';
// import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
// import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
// import PowerInputIcon from '@mui/icons-material/PowerInput';
// import Divider from '@mui/material/Divider';
// import IconButton from '@mui/material/IconButton';
// import CameraIcon from '@mui/icons-material/Camera';
// import Popover from '@mui/material/Popover';
import { useSelector, useDispatch } from 'react-redux';
import {
  // GhostHighlight,
  PdfSelection,
  usePdfHighlighterContext,
} from "react-pdf-highlighter-extended-x2";

// import EmojiList from '../../components/emoji/EmojiList';
// import { markTypes } from './AnnotationNoteUtil';
// import ColorPicker from '../../components/ColorPicker';
// import CreateAnnotationDialog from './CreateAnnotationDialog';
// import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import CreateAnnotationPanel, { SelectionType } from './CreateAnnotationPanel';
import CreateNotePanel from '../../components/chat/CreateNotePanel';
import { roundDecimals } from '../../../commons/utils/commonUtil';

import { generateImpressHTML } from '../../components/impressjs';
import skillApi from '../../api/skillApi';
import customStorage from '../../store/customStorage';

/**
 * Convert MindmapSkill result to ReactFlow format for MyMindMap component
 * @param {Object} skillResult - The result from mindmap skill { title, root, nodes, edges }
 * @returns {Object} - { keywordMap, descriptionMap } with ReactFlow format
 */
function convertSkillResultToReactFlow(skillResult) {
  const { title, root, nodes = [], edges = [] } = skillResult;
  const rfNodes = [];
  const rfEdges = [];

  // Add root node
  if (root) {
    rfNodes.push({
      id: root.id || 'root',
      position: { x: 0, y: 0 },
      data: { label: root.text || title || 'Topic' },
    });
  }

  // Convert skill nodes to ReactFlow nodes
  nodes.forEach((node, index) => {
    const level = node.level || 1;
    rfNodes.push({
      id: node.id,
      position: {
        x: level * 180,
        y: (index + 1) * 80
      },
      data: { label: node.text || '' },
    });
  });

  // Convert skill edges to ReactFlow edges
  edges.forEach((edge, index) => {
    rfEdges.push({
      id: `e${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.relation || '',
    });
  });

  const width = Math.max(300, (Math.max(...nodes.map(n => n.level || 1)) + 1) * 180);
  const height = Math.max(200, (nodes.length + 1) * 80);

  return {
    keywordMap: { width: width + 30, height: height + 30, nodes: rfNodes, edges: rfEdges },
    descriptionMap: { width: width * 1.5, height: height * 1.5, nodes: rfNodes, edges: rfEdges },
  };
}

/**
 *  onConfirm is for react-pdf-highlighter
 * @param {*} param0
 * @returns
 */
function CreatePDFAnnotationDialog({ bookId, onConfirm, animationApi, onOpenPresentation, onMindMapResult }) {
  const [compact, setCompact] = useState(true);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  // const [showImpressjs, setShowImpressjs] = useState(false);
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [emoji, setEmoji] = useState('');
  const [highlightType, setHighlightType] = useState('');
  const [isImage, setIsImage] = useState(false);
  const [CreateNote] = useCreateNoteMutation();
  const selectionRef = useRef(null);

  const dispatch = useDispatch();

  const {
    getCurrentSelection,
    removeGhostHighlight,
    setTip,
    updateTipPosition,
  } = usePdfHighlighterContext();

  React.useLayoutEffect(() => {
    if (updateTipPosition) updateTipPosition();
  }, [compact, updateTipPosition]);

  const handleAnnotationWindowClose = async (selectionType, type, color, emoji) => {
    if (selectionType === SelectionType.Cancel) {
      removeGhostHighlight();
      setTip(null);
      // setShowImpressjs(false);
      setShowNoteDialog(false);
      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.Presentation) {
      const text =  selectionRef.current ? selectionRef.current.content.text : '';
      // removeGhostHighlight();
      if (text.length > 50 && onOpenPresentation) {
        // Generate presentation HTML and open in modal
        generateImpressHTML({ paragraph: text }).then((html) => {
          if (html) {
            onOpenPresentation(html);
          }
        });
      }
      setShowNoteDialog(false);
      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.SmartSummary) {
      const text = selectionRef.current ? selectionRef.current.content.text : '';
      removeGhostHighlight();
      setTip(null);

      console.log('[SmartSummary] Starting...', {
        textLength: text?.length,
        hasAnimationApi: !!animationApi,
        hasSmartSummary: !!animationApi?.smartSummary,
      });

      if (text && text.length > 20) {
        if (!animationApi?.smartSummary) {
          console.warn('[SmartSummary] Animation API not ready');
        }

        // Execute smart summary with flying animation
        (async () => {
          try {
            // Get vocabulary words for gold highlighting
            const vocabWords = [];
            console.log('[SmartSummary] Calling smart_summary skill...');

            // Generate summary using AI
            const result = await skillApi.executeSkill('smart_summary', {
              text,
              vocabularyWords: vocabWords,
              maxWords: 30,
            });

            console.log('[SmartSummary] Skill result:', result);

            if (result.success && result.result?.summary) {
              const summaryText = result.result.summary;
              console.log('[SmartSummary] Summary:', summaryText);

              // Create save callback for the summary panel
              const handleSaveSummary = async (summary) => {
                console.log('[SmartSummary] Saving as note...');
                const position = selectionRef.current ? roundDecimals(selectionRef.current.position) : null;
                const newNote = {
                  sourceKey: bookId,
                  title: summary.substring(0, 50) + (summary.length > 50 ? '...' : ''),
                  cards: [
                    {
                      text: `**Summary:**\n${summary}\n\n**Original:**\n${text}`,
                      html: '',
                    },
                  ],
                  chapter: '',
                  chapterIndex: -1,
                  cfi: '',
                  range: '',
                  percentage: 0,
                  sourceType: 'book',
                  color: '#64b4ff',
                  tags: ['smart-summary'],
                  rate: 0,
                  hasQuiz: false,
                  position,
                  emoji: '💡',
                  highlightOnly: false,
                  highlightType: 'highlight',
                };
                const savedNote = await CreateNote(newNote);
                console.log('[SmartSummary] Note saved:', savedNote);
                return savedNote;
              };

              if (animationApi?.smartSummary) {
                console.log('[SmartSummary] Triggering animation...');
                const animResult = await animationApi.smartSummary(text, summaryText, vocabWords, {
                  onSave: handleSaveSummary,
                });
                console.log('[SmartSummary] Animation result:', animResult);
              } else {
                console.warn('[SmartSummary] No animation API - showing alert instead');
                // eslint-disable-next-line no-alert
                if (window.confirm(`Smart Summary:\n\n${summaryText}\n\nSave as note?`)) {
                  await handleSaveSummary(summaryText);
                }
              }
            } else {
              console.error('[SmartSummary] Skill failed:', result.error || 'No summary');
              // eslint-disable-next-line no-alert
              window.alert('Smart Summary failed: ' + (result.error || 'Unknown error'));
            }
          } catch (error) {
            console.error('[SmartSummary] Error:', error);
            // eslint-disable-next-line no-alert
            window.alert('Smart Summary error: ' + error.message);
          }
        })();
      } else {
        console.warn('[SmartSummary] Text too short:', text?.length);
      }

      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.MindMap) {
      const text = selectionRef.current ? selectionRef.current.content.text : '';
      removeGhostHighlight();
      setTip(null);

      console.log('[MindMap] Starting...', {
        textLength: text?.length,
        hasOnMindMapResult: !!onMindMapResult,
      });

      if (text && text.length > 20) {
        // Execute mindmap skill
        (async () => {
          try {
            console.log('[MindMap] Calling mindmap skill...');

            const result = await skillApi.executeSkill('mindmap', {
              text,
              maxNodes: 8,
              format: 'structured',
            });

            console.log('[MindMap] Skill result:', result);

            if (result.success && result.result) {
              const skillData = result.result;
              console.log('[MindMap] Skill data:', skillData);

              // Convert skill result to ReactFlow format for MyMindMap component
              const reactFlowData = convertSkillResultToReactFlow(skillData);
              console.log('[MindMap] ReactFlow data:', reactFlowData);

              // Inject mindmap result into chat panel
              if (onMindMapResult) {
                onMindMapResult({
                  skillName: 'mindmap',
                  data: reactFlowData,
                  sourceText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                });
              } else {
                console.warn('[MindMap] No onMindMapResult callback provided');
                // eslint-disable-next-line no-alert
                window.alert('Mind Map generated! Check the chat panel.');
              }
            } else {
              console.error('[MindMap] Skill failed:', result.error || 'No mindmap data');
              // eslint-disable-next-line no-alert
              window.alert('Mind Map failed: ' + (result.error || 'Unknown error'));
            }
          } catch (error) {
            console.error('[MindMap] Error:', error);
            // eslint-disable-next-line no-alert
            window.alert('Mind Map error: ' + error.message);
          }
        })();
      } else {
        console.warn('[MindMap] Text too short:', text?.length);
        // eslint-disable-next-line no-alert
        window.alert('Please select more text (at least 20 characters) to generate a mind map.');
      }

      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.Note) {
      setColor(color);
      setEmoji(emoji);
      setType(type)
      setShowNoteDialog(true);
      // setShowImpressjs(false);
      return;
    }
    const selectedContent =  selectionRef.current ? selectionRef.current.content.text : '';
    const position = selectionRef.current ? roundDecimals(selectionRef.current.position) :
       {
         boundingRect: {
          x1: 0,
          y1: 0,
          x2: 1,
          y2: 1,
          width: 1,
          height: 1,
        },
        rects: [
          {
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1,
            width: 1,
            height: 1,
          },
        ],
        pageNumber: 1,
      };
    const newNote = {
      sourceKey: bookId,
      title: selectedContent? selectedContent.substring(0,10) : '',
      cards: [
        {
          text: selectedContent,
          html: '',
        },
      ],
      chapter: '',
      chapterIndex: -1,
      cfi: '', // cfi
      range: '', // range
      percentage: 0, /// percentage
      sourceType: 'book', // type
      color, // color
      tags: [],
      rate: 0,
      hasQuiz: false, // bug, if create quiz failed?
      position,
      emoji,
      highlightOnly: true,
      highlightType: type,
    };
    const newNote2 = await CreateNote(newNote);
    removeGhostHighlight();
    setTip(null);
    onConfirm(newNote2.data ? newNote2.data : newNote2);
  };

  const handleNoteWindowClose = async (note) => {
     removeGhostHighlight();
     setTip(null);
      // setShowImpressjs(false);
      setShowNoteDialog(false);
     onConfirm(note);
  };

  if (compact) {
    return (
      <div className="Tip">
        <button
          className="Tip__compact"
          onClick={() => {
            setCompact(false);
            selectionRef.current = getCurrentSelection();
            if (selectionRef.current) selectionRef.current.makeGhostHighlight();
          }}
        >
          Add highlight
        </button>
      </div>
    )
  };
  // if (showImpressjs) {
  //   const selectedContent = selectionRef.current ? selectionRef.current.content : '';
  //   return (
  //       <Impressjs
  //         paragraph={selectedContent}
  //         closeHandler={() => setShowImpressjs(false)}
  //       />
  //   );
  // }

  if (showNoteDialog) {
    const selectedContent = selectionRef.current ? selectionRef.current.content.text : '';
    return (
      <CreateNotePanel
        sourceType='book'
        sourceKey={bookId}
        content={selectedContent}
        imageData=""
        cfi=""
        url=""
        emoji={emoji}
        color={color}
        highlightType={highlightType}
        dialogHandle={handleNoteWindowClose}
      />
    );
  }
  return  (
    <CreateAnnotationPanel
        handleWindowClose={handleAnnotationWindowClose}
        showImageOption={false}
        showPresentOption={(selectionRef.current ? selectionRef.current.content.text : '').length > 50}
        setMarkColor={(c) => setColor(c)}
        setMarkType={(t) => setType(t)}
        setEmoji={(e) => setEmoji(e)}
      />
  );
}

export default CreatePDFAnnotationDialog;
