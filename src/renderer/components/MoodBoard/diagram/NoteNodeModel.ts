import {
  NodeModel,
  NodeModelGenerics,
  PortModelAlignment,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';
import { NotePortModel } from './NotePortModel';
import Note from '../../../../commons/model/Note';
import { getNoteById } from '../../../api/notesApi';

export interface NoteNodeModelGenerics {
  PORT: NotePortModel;
}

export class NoteNodeModel extends NodeModel<
  NodeModelGenerics & NoteNodeModelGenerics
> {
  public note?: Note;

  // public noteSelectionHandler: (note: Note) => {};

  constructor({
    note = undefined,
    width = 250,
    height = 180,
  }: {
    note?: Note;
    width?: number;
    height?: number;
  }) {
    // , noteSelectionHandler: (note: Note) => {}) {
    super({
      type: 'note',
    });
    this.note = note;
    this.width = width;
    this.height = height;
    // this.noteSelectionHandler = noteSelectionHandler;
    this.addPort(new NotePortModel(PortModelAlignment.TOP));
    this.addPort(new NotePortModel(PortModelAlignment.LEFT));
    this.addPort(new NotePortModel(PortModelAlignment.BOTTOM));
    this.addPort(new NotePortModel(PortModelAlignment.RIGHT));
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  deserialize(event: DeserializeEvent<this>) {
    super.deserialize(event);
    const { noteId, width, height } = event.data;
    // console.log(`deserialize width  = ${width}  height = ${height}`);
    this.width = width || 250;
    this.height = height || 180;
    if (noteId) {
      const that = this;
      // eslint-disable-next-line no-inner-declarations
      async function t() {
        that.note = await getNoteById(noteId);
      }
      t();
    }
  }

  serialize() {
    // console.log(`serialize width  = ${this.width}  height = ${this.height}`);
    return {
      ...super.serialize(),
      noteId: this.note ? this.note.id : 0,
      width: this.width,
      height: this.height,
    };
  }
}
