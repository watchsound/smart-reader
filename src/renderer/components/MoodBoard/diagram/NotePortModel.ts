/* eslint-disable import/prefer-default-export */
import {
  LinkModel,
  PortModel,
  DefaultLinkModel,
  PortModelAlignment,
} from '@projectstorm/react-diagrams';
import CustomLinkModel from './CustomLinkModel';
import store from '../../../store/store';

export class NotePortModel extends PortModel {
  constructor(alignment: PortModelAlignment) {
    super({
      type: 'note',
      name: alignment,
      alignment,
    });
  }

  createLinkModel(): LinkModel {
    const { linkModel } = store.getState().moodBoard;
    if (linkModel === 'default') return new DefaultLinkModel();
    return new CustomLinkModel();
  }
}
