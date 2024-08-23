/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { useEffect, useState, useRef } from 'react';
import _ from 'lodash';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import { styled } from '@mui/system';
import Button from '@mui/material/Button';

import store from '../../../store/store';
// Import styles from react-grid-layout and react-resizable
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './moodboard.css';
import { updateMoodBoard } from '../../../api/moodBoardApi';
import { moodBoardUpdated } from '../../../store/reducers/moodBoardSlice';
import { getNoteById } from '../../../api/notesApi';
import NoteUI from '../../note/NoteUI';
import SmallButton from '../../Button/SmallButton';
import NoteDetailModal from '../../note/NoteDetailModal';
import NotesSliderView from '../../slider/NotesSliderView';

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const props = {
  className: 'layout',
  rowHeight: 30,
  onLayoutChange() {},
  cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
};

// Example usage
// const gridProps = {
//   cols: props.cols.lg,
//   rowHeight: props.rowHeight,
//   margin: [10, 10],
//   containerWidth: 1200,
//   containerPadding: [0, 0],
// };

function layoutToPx(
  layoutItem,
  cols,
  rowHeight,
  margin,
  containerWidth,
  containerPadding,
) {
  const columnWidth =
    (containerWidth - containerPadding[0] * 2 - margin[0] * (cols - 1)) / cols;

  const xPx = containerPadding[0] + layoutItem.x * (columnWidth + margin[0]);
  const yPx = containerPadding[1] + layoutItem.y * (rowHeight + margin[1]);
  const widthPx = layoutItem.w * columnWidth + (layoutItem.w - 1) * margin[0];
  const heightPx = layoutItem.h * rowHeight + (layoutItem.h - 1) * margin[1];

  return {
    x: xPx || 0,
    y: yPx || 0,
    width: widthPx || 20,
    height: heightPx || 20,
  };
}

const availableHandles = ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'];

function DetailedMoodBoardPanel({ curMoodBoard }) {
  const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
  const [compactType, setCompactType] = useState('vertical');
  const [resizeHandles, setResizeHandles] = useState(['se']);
  const [mounted, setMounted] = useState(false);
  const [moodBoard, setMoodBoard] = useState({});
  const [ids, setIds] = useState([]);

  const [layout, setLayout] = useState({ lg: [] });
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [openNoteModal, setOpenNoteModal] = useState(false);
  const [openSliderModal, setOpenSliderModal] = useState(false);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // const [curNote, setCurNote] = useState(null);
  const dispatch = useDispatch();
  const newAddedNote = useSelector((state) => state.moodBoard.addedNote);

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => {
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addNewNote = // useCallback(
    (note) => {
      if (!note) return;
      if (ids.includes(note.id)) return;
      const y = 4;
      const n = {
        x: Math.round(Math.random() * 5) * 2,
        y: Math.floor(notes.length / 6) * y,
        w: 2,
        h: y,
        i: note.id,
        //  static: Math.random() < 0.5,
        resizeHandles,
      };
      setNotes([...notes, note]);
      setIds([...ids, note.id]);
      setLayout({ lg: [...layout.lg, n] });
    };
  //  , [notes],
  // );

  useEffect(() => {
    if (!newAddedNote) return;
    addNewNote(newAddedNote);
  }, [newAddedNote]);

  // useEffect(() => {
  //   const w = watch(store.getState, 'moodBoard.addedNote', isEqual);
  //   const unsubscribe = store.subscribe(
  //     w((newVal, oldVal, objectPath) => {
  //       setTimeout(() => {
  //         addNewNote(newVal);
  //       }, 100);
  //     }),
  //   );
  //   return () => unsubscribe();
  // }, [notes, addNewNote]);

  useEffect(() => {
    if (!curMoodBoard) return;
    setMoodBoard(curMoodBoard);
    const curLayout = curMoodBoard.gridLayout;
    setLayout(curLayout.layout);
    if (curLayout.configuration && curLayout.configuration.compactType)
      setCompactType(curLayout.configuration.compactType);
    if (curLayout.configuration && curLayout.configuration.resizeHandles)
      setResizeHandles(curLayout.configuration.resizeHandles);

    async function t() {
      const newNotes = [];
      const newIds = [];
      const items = curLayout.layout.lg || [];
      for (let i = 0; i < items.length; i++) {
        const id = items[i].i;
        newNotes.push(getNoteById(id));
        newIds.push(id);
      }

      setIds(newIds);
      setNotes(await Promise.all(newNotes));
    }
    t();
  }, [curMoodBoard]);

  const selectNoteHandler = (note) => {
    console.log(`selectedNote = ${note.id}`);
  };

  const deleteNoteHandler = (note) => {
    console.log(`deleteNoteHandler = ${note.id}`);
    setLayout({ lg: _.reject(layout.lg, { i: note.id }) });
    setNotes(_.reject(notes, { id: note.id }));
    setIds(ids.filter((ele) => ele === note.id));
  };

  const generateDOM = () => {
    return _.map(layout.lg, function (l, i) {
      const { x, y, width, height } = layoutToPx(
        l,
        props.cols.lg,
        props.rowHeight,
        [10, 10],
        containerWidth,
        [0, 0],
      );
      return (
        <div key={i} style={{ left: x, top: y, width, height }}>
          <NoteUI
            key={notes[i].id}
            selectedNoteKey={notes[i].id}
            selectHandler={() => {}}
            compactView
            customAction={(n) => {
              setSelectedNote(n);
              setOpenNoteModal(true);
            }}
            customActionName="Show Details"
            showQuizHandler={() => {}}
            deleteAction={(n) => deleteNoteHandler(n)}
            deleteActionName="Remove From Board"
            cardWidth="800"
            cardHeight="600"
            useBgColor
          />
        </div>
      );
    });
  };

  const onCompactTypeChange = () => {
    const newCompactType =
      compactType === 'horizontal'
        ? 'vertical'
        : compactType === 'vertical'
          ? null
          : 'horizontal';
    setCompactType(newCompactType);
  };

  const onRandomize = () => {
    const newLayouts = [];
    for (let i = 0; i < layout.lg.length; i++) {
      const y = Math.ceil(Math.random() * 4) + 1;
      const n = {
        x: Math.round(Math.random() * 5) * 2,
        y: Math.floor(notes.length / 6) * y,
        w: layout.lg[i].w,
        h: layout.lg[i].h,
        i: layout.lg[i].i,
        //  static: Math.random() < 0.5,
        resizeHandles,
      };
      newLayouts.push(n);
    }
    setLayout({ lg: newLayouts });
  };

  const onResizeTypeChange = () => {
    const newResizeHandles =
      resizeHandles === availableHandles ? ['se'] : availableHandles;
    setResizeHandles(newResizeHandles);
    const newLayouts = [];
    layout.lg.forEach((element) => {
      newLayouts.push({
        ...element,
        resizeHandles: newResizeHandles,
      });
    });
    setLayout({ lg: newLayouts });
  };

  const onBreakpointChange = (breakpoint) => {
    setCurrentBreakpoint(breakpoint);
  };

  const OnLayoutChangeCallback = (layout, layouts) => {
    setLayout(layouts);
  };

  const onDrop = (layout, item, e) => {
    if (!item) return;
    console.log(`Element parameters: ${JSON.stringify(item)}`);
    if (typeof item.id === 'undefined') return;
    if (ids.includes(item.id)) return;
    addNewNote(item);
  };

  const onSaveGridLayout = () => {
    const a = {
      layout,
      configuration: {
        compactType,
        resizeHandles,
      },
    };
    const c = updateMoodBoard(
      moodBoard.id,
      'react_grid_layout',
      JSON.stringify(a),
    );
    if (c) dispatch(moodBoardUpdated(c));
  };

  // Props spreading for simplicity, consider enumerating specific props as best practice.
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <SmallButton type="button" onClick={onRandomize}>
        Random Arrange
      </SmallButton>
      <SmallButton type="button" onClick={onCompactTypeChange}>
        Change Compaction Type
      </SmallButton>
      <SmallButton type="button" onClick={onResizeTypeChange}>
        Resize{' '}
        {resizeHandles === availableHandles ? 'One Corner' : 'All Corners'}
      </SmallButton>
      <SmallButton type="button" onClick={() => setOpenSliderModal(true)}>
        Open SliderView
      </SmallButton>
      <SmallButton type="button" onClick={onSaveGridLayout}>
        Save
      </SmallButton>
      <ResponsiveReactGridLayout
        {...props}
        layouts={layout}
        onBreakpointChange={onBreakpointChange}
        onLayoutChange={OnLayoutChangeCallback}
        onDrop={onDrop}
        measureBeforeMount={false}
        useCSSTransforms={mounted}
        compactType={compactType}
        preventCollision={!compactType}
      >
        {containerWidth > 0 && generateDOM()}
      </ResponsiveReactGridLayout>
      {openNoteModal && selectedNote && (
        <NoteDetailModal
          note={selectedNote}
          open
          callback={() => setOpenNoteModal(false)}
        />
      )}
      {openSliderModal && notes && (
        <NotesSliderView
          notes={notes}
          open
          callback={() => setOpenSliderModal(false)}
        />
      )}
    </div>
  );
}

export default DetailedMoodBoardPanel;
