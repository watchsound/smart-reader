/* eslint-disable no-useless-constructor */
/* eslint-disable max-classes-per-file */
/* eslint-disable class-methods-use-this */
import { Highlight } from 'marks-pane';

export class Highlightmark extends Highlight {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  useClickArea() {
    return true;
  }

  yOffset(range) {
    return 0;
  }

  lineExtraStyle(line) {}

  addExtraEndMark(docFrag, container, lastRange) {}

  addEmojiMark(docFrag, container, lastRange, emoji) {
    const offset = this.element.getBoundingClientRect();
    const note = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    note.setAttribute('x', lastRange.left - 20);
    note.setAttribute('y', lastRange.top - offset.top + container.top - 1);
    note.setAttribute('width', 18);
    note.setAttribute('height', 18);
    note.setAttribute('font-size', '18');
   // note.setAttribute('fill', 'white');
    note.textContent = emoji;

    docFrag.appendChild(note);
  }

  render() {
    // Empty element
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    const docFrag = this.element.ownerDocument.createDocumentFragment();
    const filtered = this.filteredRanges();
    const offset = this.element.getBoundingClientRect();
    const container = this.container.getBoundingClientRect();

    for (let i = 0, len = filtered.length; i < len; i++) {
      const r = filtered[i];
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect',
      );
      rect.setAttribute('x', r.left - offset.left + container.left);
      rect.setAttribute('y', r.top - offset.top + container.top);
      rect.setAttribute('height', r.height);
      rect.setAttribute('width', r.width);

      this.lineExtraStyle(rect);
      docFrag.appendChild(rect);
    }
    if (this.data && this.data.emoji) {
      this.addEmojiMark(
        docFrag,
        container,
        filtered[filtered.length - 1],
        this.data.emoji,
      );
    }
    this.addExtraEndMark(docFrag, container, filtered[filtered.length - 1]);
    this.element.appendChild(docFrag);
  }
}

class LineMark extends Highlightmark {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  yOffset(range) {
    return 0;
  }

  render() {
    // Empty element
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    const docFrag = this.element.ownerDocument.createDocumentFragment();
    const filtered = this.filteredRanges();
    const offset = this.element.getBoundingClientRect();
    const container = this.container.getBoundingClientRect();

    for (let i = 0, len = filtered.length; i < len; i++) {
      const r = filtered[i];
      let rect;
      if (this.useClickArea()) {
        rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', r.left - offset.left + container.left);
        rect.setAttribute('y', r.top - offset.top + container.top);
        rect.setAttribute('height', r.height);
        rect.setAttribute('width', r.width);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#00000000');
      }

      const yoffset = this.yOffset(r);
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      );
      line.setAttribute('x1', r.left - offset.left + container.left);
      line.setAttribute('x2', r.left - offset.left + container.left + r.width);
      line.setAttribute('y1', r.top - offset.top + container.top + yoffset - 1);
      line.setAttribute('y2', r.top - offset.top + container.top + yoffset - 1);

      line.setAttribute('stroke-width', 2);
      this.lineExtraStyle(line);
      if (rect) docFrag.appendChild(rect);
      docFrag.appendChild(line);
    }
    if (this.data && this.data.emoji) {
      this.addEmojiMark(
        docFrag,
        container,
        filtered[filtered.length - 1],
        this.data.emoji,
      );
    }
    this.addExtraEndMark(docFrag, container, filtered[filtered.length - 1]);
    this.element.appendChild(docFrag);
  }
}

export class Underline extends LineMark {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  yOffset(range) {
    return range.height;
  }

  lineExtraStyle(line) {}
}

export class Dashline extends LineMark {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  yOffset(range) {
    return range.height;
  }

  lineExtraStyle(line) {
    line.setAttribute('stroke-dasharray', '6 4');
  }
}

export class Strikeline extends LineMark {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  yOffset(range) {
    return range.height / 2;
  }

  lineExtraStyle(line) {}
}

export class Hasicon extends Dashline {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  iconHref() {
    return '';
  }

  useClickArea() {
    return false;
  }

  addExtraEndMark(docFrag, container, lastRange) {
    const offset = this.element.getBoundingClientRect();
    const note = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'image',
    );
    note.setAttribute(
      'x',
      lastRange.left - offset.left + container.left + lastRange.width,
    );
    note.setAttribute('y', lastRange.top - offset.top + container.top - 1);
    note.setAttribute('width', 16);
    note.setAttribute('height', 16);
    note.setAttribute('href', this.iconHref());

    docFrag.appendChild(note);
  }
  // addExtraEndMark2(docFrag, container, lastRange){
  //     var offset = this.element.getBoundingClientRect();
  //     // <text x="10" y="40" font-family="Font Awesome" font-size="40" class="fa">&#xf2b9;</text>
  //     var note = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  //     note.setAttribute('x',  lastRange.left - offset.left + container.left + lastRange.width);
  //     note.setAttribute('y', lastRange.top - offset.top + container.top  - 1);

  //     note.setAttribute('font-family',  'Font Awesome 5 Free');
  //      note.setAttribute('class',  'fa-solid fa-comments');

  //    note.setAttribute('width',  20);
  //    note.setAttribute('height',  20);

  //     var textNode = document.createTextNode('&#xf086;');
  //     note.appendChild(textNode);

  //     docFrag.appendChild(note);
  // }
}

export class Hasnote extends Hasicon {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  iconHref() {
    const bgImageSrc = `${this.assetsPath}/images/note-16.png`;
    const imageUrl = `file://${bgImageSrc.replace(/\\/g, '/')}`;
    return imageUrl;
  }
}
export class Hasdiscussion extends Hasicon {
  constructor(range, className, data, attributes, assetsPath) {
    super(range, className, data, attributes);
    this.assetsPath = assetsPath;
  }

  iconHref() {
    const bgImageSrc = `${this.assetsPath}/images/chat-16.png`;
    const imageUrl = `file://${bgImageSrc.replace(/\\/g, '/')}`;
    return imageUrl;
  }
}
