/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
// import { Responsive, WidthProvider } from 'react-grid-layout';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import { IconButton, SvgIcon } from '@mui/material';
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
import GridViewIcon from '@mui/icons-material/GridView';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import TimelineIcon from '@mui/icons-material/Timeline';
// import OpenAI from 'openai';

import SmallButton from '../../Button/SmallButton';
import store from '../../../store/store';

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
import aiProviderManager from '../../../../commons/service/AIProviderManager';
import { adjustFontSize } from '../../../utils/common';

function DetailedDiagramPanel({ curMoodBoard }) {
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
    <div>
      <div className="two_end_container">
        <div className="two_end_start">
          <ZoomControls engine={engineRef.current} />
          <ColorPicker
            title="Canvas"
            colorHandler={(color) => setCanvasBackground(color)}
          />
          <ColorPicker
            title="Edge"
            colorHandler={(color) => ballLinkFactoryRef.current.setColor(color)}
          />
          <ToggleButton
            onToggle={handleEditToggle}
            iconActive={VisibilityIcon}
            iconInactive={VisibilityOffIcon}
            labelActive="Edit"
            labelInactive="View"
            title="Toggle Between Edit and View Mode"
          />
          <ToggleButton
            onToggle={handleLinkTypeToggle}
            iconActive={LinearScaleIcon}
            iconInactive={TimelineIcon}
            labelActive="Line"
            labelInactive="Curve"
            title="Toggle Between Different Link Type"
          />
          <Tooltip title="show/hide control for card">
            <IconButton aria-label="Layout" onClick={toggleShowCardControl}>
              <BuildCircleIcon />
            </IconButton>
          </Tooltip>
        </div>
        <div className="two_end_end">
          <Tooltip title="Use AI TO Create New Layout">
            <IconButton aria-label="Layout" onClick={createLayoutByAI}>
              <SvgIcon component={GridViewIcon} />
            </IconButton>
          </Tooltip>
          <SmallButton
            type="button"
            startIcon={<PausePresentationIcon />}
            onClick={() => setOpenSliderModal(true)}
          >
            Open SliderView
          </SmallButton>
          <SmallButton
            type="button"
            startIcon={<SaveIcon />}
            onClick={onSaveGridLayout}
          >
            Save
          </SmallButton>
        </div>
      </div>
      {diagramPanel}
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
    </div>
  );
}

export default DetailedDiagramPanel;
