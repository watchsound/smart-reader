import customStorage from '../../store/customStorage';

class HistoryTree {
  constructor() {
    this.current = null;
    this.next = null;
  }

  // Add a new history item
  async addHistory(url, fromTypeInput) {
    const newNode = { url, fromTypeInput, parent: this.current, children: [] };
    if (this.current) {
      const exist = this.current.children.filter((n) => n.url === url);
      if (exist.length > 0) {
        this.current = exist[0];
        return;
      }
      newNode.groupId = this.current.groupId;
      this.current.children.push(newNode);
    }
    if (fromTypeInput || !this.current) {
      const group = await customStorage.createHistoryGroup('');
      newNode.groupId = group.id;
    } else {
      const h = await customStorage.getHistoryByGroupIdAndSourceKey(
        this.current.groupId,
        url,
      );
      if (h) {
        this.current = newNode;
        return;
      }
    }
    await customStorage.createHistory({
      sourceKey: url,
      sourceType: 'url',
      description: '',
      groupId: newNode.groupId,
    });
    this.current = newNode;
  }

  canBack() {
    return this.current && this.current.parent;
  }

  // Go back to the parent history item
  back() {
    if (this.canBack()) {
      this.next = this.current;
      this.current = this.current.parent;
      return this.current.url;
    }
    return null;
  }

  canForward() {
    return this.current && this.current.children.length > 0;
  }

  simpleForward() {
    if (!this.next || !this.canForward()) return null;
    const index = this.current.children.indexOf(this.next);
    if (index >= 0) {
      return this.forward(index);
    }
    return null;
  }

  // Go forward to one of the child history items
  forward(index) {
    if (this.canForward()) {
      if (index >= 0 && index < this.current.children.length) {
        this.current = this.current.children[index];
        return this.current.url;
      }
      throw new Error('Invalid index for forward operation.');
    } else {
      return null;
    }
  }

  // Get a list of forward choices (children of the current node)
  getForwardChoices() {
    if (this.canForward()) {
      return this.current.children.map((child) => child.url);
    }
    return [];
  }
}

export default HistoryTree;

// // Example usage:
// const historyTree = new HistoryTree();

// // Add history items
// historyTree.addHistory({ url: 'http://example.com/page1' });
// historyTree.addHistory({ url: 'http://example.com/page2' });

// // Go back
// console.log(historyTree.back()); // { url: 'http://example.com/page1' }

// // Add another history item
// historyTree.addHistory({ url: 'http://example.com/page3' });

// // Check forward choices (should be empty since we added a new item)
// console.log(historyTree.getForwardChoices()); // []

// // Go back
// console.log(historyTree.back()); // { url: 'http://example.com/page1' }

// // Check forward choices
// console.log(historyTree.getForwardChoices()); // [{ url: 'http://example.com/page2' }, { url: 'http://example.com/page3' }]

// // Go forward
// console.log(historyTree.forward(1)); // { url: 'http://example.com/page3' }
