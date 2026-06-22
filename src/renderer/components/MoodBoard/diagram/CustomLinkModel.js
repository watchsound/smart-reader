import { DefaultLinkModel } from '@projectstorm/react-diagrams';

const DEFAULT_RELATION = 'supports';

class CustomLinkModel extends DefaultLinkModel {
  constructor(options = {}) {
    super({
      ...options,
      type: 'custom-link',
    });
    this.color = options.color || 'red';
    this.relationType = options.relationType || DEFAULT_RELATION;
  }

  setRelationType(relationType) {
    this.relationType = relationType;
    // Storm-react-diagrams listens to fireEvent for repaint; if absent on this
    // version, repaint is driven by the renderer-side useEffect anyway.
    if (typeof this.fireEvent === 'function') {
      this.fireEvent({ relationType }, 'relationTypeChanged');
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      color: this.color,
      relationType: this.relationType,
    };
  }

  deserialize(event) {
    super.deserialize(event);
    this.color = event.data.color;
    this.relationType = event.data.relationType || DEFAULT_RELATION;
  }
}

export default CustomLinkModel;
