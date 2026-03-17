/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
// import { Responsive, WidthProvider } from 'react-grid-layout';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import { IconButton, SvgIcon, Divider, Chip, Button, CircularProgress } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import {
  CanvasWidget,
  DeleteItemsAction,
} from '@projectstorm/react-canvas-core';
import createEngine, {
  DefaultNodeModel,
  DiagramModel,
  PortModelAlignment,
  ZoomCanvasAction,
  DefaultLinkFactory,
} from '@projectstorm/react-diagrams';
import SaveIcon from '@mui/icons-material/Save';
import PausePresentationIcon from '@mui/icons-material/PausePresentation';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import GridViewIcon from '@mui/icons-material/GridView';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import PreviewIcon from '@mui/icons-material/Preview';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import TimelineIcon from '@mui/icons-material/Timeline';
import PaletteIcon from '@mui/icons-material/Palette';
import SettingsIcon from '@mui/icons-material/Settings';
// import OpenAI from 'openai';

import SmallButton from '../../Button/SmallButton';
import store from '../../../store/store';

// Styled components for the toolbar
const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  gap: theme.spacing(1),
}));

const ToolbarSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

const ToolbarButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})(({ theme, isActive }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: isActive
    ? alpha(theme.palette.primary.main, 0.1)
    : 'transparent',
  color: isActive
    ? theme.palette.primary.main
    : theme.palette.text.secondary,
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: isActive
      ? alpha(theme.palette.primary.main, 0.15)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

const ToolbarDivider = styled(Divider)(({ theme }) => ({
  height: 24,
  margin: '0 8px',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  height: 32,
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'none',
  borderRadius: theme.shape.borderRadius,
  padding: '4px 12px',
  minWidth: 'auto',
}));

import { updateMoodBoard } from '../../../api/moodBoardApi';
import {
  moodBoardUpdated,
  editStateChanged,
  linkModelChanged,
  showControlChanged,
} from '../../../store/reducers/moodBoardSlice';

import { NoteNodeModel } from './NoteNodeModel';
import { NoteNodeFactory } from './NoteNodeFactory';
import { SimplePortFactory } from './SimplePortFactory';
import { NotePortModel } from './NotePortModel';
import { DemoCanvasWidget } from './DemoCanvasWidget';
import NoteDetailModal from '../../note/NoteDetailModal';
import { isEmpty } from '../../../../commons/utils/commonUtil';
import NotesSliderView from '../../slider/NotesSliderView';
import ZoomControls from './ZoomControls';
import ColorPicker from './ColorPicker';
// import CustomLinkModel from './CustomLinkModel';
// import CustomLinkWidget from './CustomLinkWidget';
import CustomLinkFactory from './CustomLinkFactory';
// import ContextMenu from './ContextMenu';
import ToggleButton from './ToggleButton';
import customStorage from '../../../store/customStorage';
import { createMoodBoardLayoutPrompt } from '../../../../commons/utils/AIPrompts';
import { instanceInRender as aiProviderManager } from '../../../../commons/service/AIProviderManager';
import { adjustFontSize } from '../../../utils/common';

function DetailedDiagramPanel({ curMoodBoard }) {
  const theme = useTheme();
  const [moodBoard, setMoodBoard] = useState({});
  const [, forceUpdate] = useState(0); // state not directly used by the component
  const [openNoteModal, setOpenNoteModal] = useState(false);
  const [openSliderModal, setOpenSliderModal] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState(null);
  const [curNote, setCurNote] = useState(null);
  // const [apiKey, setApiKey] = useState('');
  // const [model, setModel] = useState('');
  const [inProcess, setInProcess] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const curDiagramNote = useSelector((state) => state.moodBoard.curDiagramNote);
  const curEditState = useSelector((state) => state.moodBoard.editState);
  const showCardControl = useSelector((state) => state.moodBoard.showControl);
  const componentRef = useRef(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      }
    });
    if (componentRef.current) {
      resizeObserver.observe(componentRef.current);
    }

    return () => {
      if (componentRef.current) {
        resizeObserver.unobserve(componentRef.current);
      }
    };
  }, []);

  const handleUpdate = () => {
    forceUpdate((n) => n + 1); // increment state to trigger re-render
  };
  const dispatch = useDispatch();

  const toggleShowCardControl = () => {
    dispatch(showControlChanged(!showCardControl));
  };


  useEffect(() => {
    if (!curDiagramNote) return;
    setCurNote(curDiagramNote);
    setOpenNoteModal(true);
  }, [curDiagramNote]);

  const ballLinkFactoryRef = useRef(null);
  if (!ballLinkFactoryRef.current) {
    ballLinkFactoryRef.current = new CustomLinkFactory({ color: 'red' });
  }
  const linkFactoryRef = useRef(null);
  if (!linkFactoryRef.current) {
    linkFactoryRef.current = new DefaultLinkFactory();
  }

  const modelRef = useRef(null);
  if (!modelRef.current) {
    modelRef.current = new DiagramModel();
  }

  // useEffect(() => {
  //   modelRef.current.setLocked(!curEditState);
  // }, [curEditState]);

  const engineRef = useRef(null);

  // Function to setup link listener for auto-delete of dangling links
  const setupLinkAutoDelete = (model, eng) => {
    model.registerListener({
      linksUpdated: (event) => {
        const { link, isCreated } = event;
        if (!isCreated) return;

        // Listen for when the user stops dragging the link
        const linkListener = link.registerListener({
          targetPortChanged: () => {
            // Give a short delay for the link to settle
            setTimeout(() => {
              // If the link doesn't have both source and target ports, remove it
              if (!link.getSourcePort() || !link.getTargetPort()) {
                try {
                  link.remove();
                  eng.repaintCanvas();
                } catch (e) {
                  // Link might already be removed
                }
              }
            }, 150);
          },
        });

        // Also check after mouse up events
        const handleMouseUp = () => {
          setTimeout(() => {
            if (!link.getSourcePort() || !link.getTargetPort()) {
              try {
                link.remove();
                eng.repaintCanvas();
              } catch (e) {
                // Link might already be removed
              }
            }
          }, 200);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mouseup', handleMouseUp);
      },
    });
  };

  if (!engineRef.current) {
    const eng = createEngine({
      registerDefaultDeleteItemsAction: false,
    });
    eng
      .getPortFactories()
      .registerFactory(
        new SimplePortFactory(
          'note',
          (config) => new NotePortModel(PortModelAlignment.LEFT),
        ),
      );
    // eng.getActionEventBus().registerAction(
    //   new ZoomCanvasAction({
    //     inverseZoom: true,
    //   }),
    // );
    eng.getNodeFactories().registerFactory(new NoteNodeFactory());

    eng.getLinkFactories().registerFactory(ballLinkFactoryRef.current);
    eng.getLinkFactories().registerFactory(linkFactoryRef.current);
    eng
      .getActionEventBus()
      .registerAction(new DeleteItemsAction({ keyCodes: [46] }));

    // Setup auto-delete for dangling links
    setupLinkAutoDelete(modelRef.current, eng);

    eng.setModel(modelRef.current);
    engineRef.current = eng;
  }

  const selectNoteHandler = (note) => {
    console.log(`selectedNote = ${note.id}`);
  };

  const getOriginalNotes = () => {
    const notes = [];
    engineRef.current
      .getModel()
      .getNodes()
      .forEach((n) => {
        notes.push(n.note);
      });
    return notes;
  };

  const addNewNote = useCallback(
    (note, x, y, width, height) => {
      if (!note) return;
      const node2 = new NoteNodeModel({ note, width, height });
      node2.setPosition(x, y);
      engineRef.current.getModel().addNode(node2);
      handleUpdate(); // Ensure handleUpdate is stable or also wrapped in useCallback if defined in this component
    },
    [engineRef],
  );

  useEffect(() => {
    const w = watch(store.getState, 'moodBoard.addedNote', isEqual);
    const unsubscribe = store.subscribe(
      w((newVal, oldVal, objectPath) => {
        setTimeout(() => {
          addNewNote(newVal, 250, 300, 250, 180);
        }, 100);
      }),
    );
    return () => unsubscribe();
  }, [addNewNote]);

  useEffect(() => {
    if (!curMoodBoard) return;
    setMoodBoard(curMoodBoard);
    const aModel = new DiagramModel();
    if (!isEmpty(curMoodBoard.diagram)) {
      aModel.deserializeModel(curMoodBoard.diagram, engineRef.current);
    }
    engineRef.current.setModel(aModel);
  }, [curMoodBoard]);

  const onDrop = (layout, item, e) => {
    if (!item) return;
    console.log(`Element parameters: ${JSON.stringify(item)}`);
    if (typeof item.id === 'undefined') return;
    // if (ids.includes(item.id)) return;
    addNewNote(item, 250, 300, 250, 180);
  };

  function clearDiagram(engine) {
    const model = engine.getModel();
    const nodes = model.getNodes();
    const links = model.getLinks();
    nodes.forEach((node) => model.removeNode(node));
    links.forEach((link) => model.removeLink(link));
    engine.repaintCanvas();
  }

  const createLayoutByAI = async () => {
    if (inProcess) return;
    setInProcess(true);
    try {
      createLayoutByAIImpl();
    } catch (e) {
      console.log(e);
    } finally {
      setInProcess(false);
    }
  };

  const createLayoutByAIImpl = async () => {
    const notes = getOriginalNotes();
    let notesList = '';
    notes.forEach((value, index) => {
      let c = value.title || '';
      if (value.cards && value.cards.length > 0) c = value.cards[0].text;
      notesList += `$(index). ${c}. \n`;
    });
    const width = size.width ?? 650;
    const height = size.height ?? 450;
    const layoutPrompt = createMoodBoardLayoutPrompt(width, height, notesList);
    const layout = await aiProviderManager.generateContentWithJson(
      layoutPrompt,
      false,
    );
    if (!layout) {
      setInProcess(false);
      return;
    }
    const layoutJson = await aiProviderManager.extractJsonData(layout);
    if (!layoutJson) {
      setInProcess(false);
      return;
    }
    console.log(JSON.stringify(layoutJson));
    clearDiagram(engineRef.current);
    layoutJson.layout.forEach((n) => {
      const note = notes[n.cardIndex - 1];
      const fontSize = adjustFontSize({
        text: note.cards[0].text,
        width: n.width - 20,
        height: n.height - 30,
        defaultFontSize: 18,
      });
      console.log(`fontSize = ${fontSize}`);
      const node2 = new NoteNodeModel({
        note: { ...note, color: n.color, fontSize },
        width: n.width,
        height: n.height,
      });
      node2.setPosition(n.x, n.y);
      engineRef.current.getModel().addNode(node2);
    });
    handleUpdate();
    setInProcess(false);
  };

  const handleLinkTypeToggle = (state) => {
    console.log('link type is:', state ? 'On' : 'Off');
    if (state) {
      dispatch(linkModelChanged(ballLinkFactoryRef.current.getType()));
    } else {
      dispatch(linkModelChanged(linkFactoryRef.current.getType()));
    }
  };

  const handleEditToggle = (state) => {
    console.log('control edit is:', state ? 'On' : 'Off');
    dispatch(editStateChanged(state));
  };

  const onSaveGridLayout = () => {
    const str = JSON.stringify(engineRef.current.getModel().serialize());
    const c = updateMoodBoard(moodBoard.id, 'react_diagram', str);
    if (c) dispatch(moodBoardUpdated(c));
  };

  const diagramPanel = useMemo(() => {
    return (
      <div ref={componentRef} style={{ height: 'calc(100vh - 65px)' }}>
        <DemoCanvasWidget background={canvasBackground}>
          <CanvasWidget engine={engineRef.current} />
        </DemoCanvasWidget>
      </div>
    );
  }, [canvasBackground]);

  // Props spreading for simplicity, consider enumerating specific props as best practice.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Professional Toolbar */}
      <ToolbarContainer>
        {/* Left Section - Zoom & View Controls */}
        <ToolbarSection>
          <ZoomControls engine={engineRef.current} />

          <ToolbarDivider orientation="vertical" flexItem />

          {/* Edit/View Mode Toggle */}
          <Tooltip title={curEditState ? 'Switch to View Mode' : 'Switch to Edit Mode'}>
            <ToolbarButton
              isActive={curEditState}
              onClick={() => handleEditToggle(!curEditState)}
            >
              {curEditState ? <EditIcon sx={{ fontSize: 18 }} /> : <PreviewIcon sx={{ fontSize: 18 }} />}
            </ToolbarButton>
          </Tooltip>

          {/* Link Type Toggle */}
          <Tooltip title="Toggle line style">
            <ToolbarButton onClick={() => handleLinkTypeToggle(!curEditState)}>
              <TimelineIcon sx={{ fontSize: 18 }} />
            </ToolbarButton>
          </Tooltip>

          <ToolbarDivider orientation="vertical" flexItem />

          {/* Color Pickers */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ColorPicker
              title="Canvas"
              colorHandler={(color) => setCanvasBackground(color)}
            />
            <ColorPicker
              title="Edge"
              colorHandler={(color) => ballLinkFactoryRef.current.setColor(color)}
            />
          </Box>

          <ToolbarDivider orientation="vertical" flexItem />

          {/* Card Controls Toggle */}
          <Tooltip title={showCardControl ? 'Hide card controls' : 'Show card controls'}>
            <ToolbarButton
              isActive={showCardControl}
              onClick={toggleShowCardControl}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </ToolbarButton>
          </Tooltip>
        </ToolbarSection>

        {/* Center - Board Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {moodBoard.name || 'Untitled Board'}
          </Typography>
          {moodBoard.pinned && (
            <Chip
              label="Pinned"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: theme.palette.warning.main,
              }}
            />
          )}
        </Box>

        {/* Right Section - Actions */}
        <ToolbarSection>
          {/* AI Layout Button */}
          <Tooltip title="Auto-arrange with AI">
            <ActionButton
              variant="outlined"
              startIcon={inProcess ? <CircularProgress size={14} /> : <AutoFixHighIcon sx={{ fontSize: 16 }} />}
              onClick={createLayoutByAI}
              disabled={inProcess}
              sx={{
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                },
              }}
            >
              {inProcess ? 'Processing...' : 'AI Layout'}
            </ActionButton>
          </Tooltip>

          {/* Slideshow Button */}
          <Tooltip title="Present as slideshow">
            <ActionButton
              variant="outlined"
              startIcon={<SlideshowIcon sx={{ fontSize: 16 }} />}
              onClick={() => setOpenSliderModal(true)}
              sx={{
                borderColor: alpha(theme.palette.text.secondary, 0.3),
                color: theme.palette.text.secondary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                },
              }}
            >
              Present
            </ActionButton>
          </Tooltip>

          {/* Save Button */}
          <Tooltip title="Save changes">
            <ActionButton
              variant="contained"
              startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
              onClick={onSaveGridLayout}
              sx={{
                bgcolor: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                },
              }}
            >
              Save
            </ActionButton>
          </Tooltip>
        </ToolbarSection>
      </ToolbarContainer>

      {/* Diagram Canvas */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {diagramPanel}
      </Box>

      {/* Modals */}
      {openNoteModal && curNote && (
        <NoteDetailModal
          note={curNote}
          open
          callback={() => setOpenNoteModal(false)}
        />
      )}
      {openSliderModal && (
        <NotesSliderView
          notes={getOriginalNotes()}
          open
          callback={() => setOpenSliderModal(false)}
        />
      )}
    </Box>
  );
}

export default DetailedDiagramPanel;
