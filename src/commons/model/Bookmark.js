// code is modified from koodo reader
class Bookmark {
  constructor(sourceKey, cfi, title, percentage) {
    this.id = new Date().getTime() + ""; // unique within a user collection,
    // the id is overloaded with semantic stuff..
    // in general, it is not a good idea
    this.sourceKey = sourceKey; // id of Book
    this.cfi = cfi; // cfi value (xpath to it)
    this.title = title;
    this.percentage = percentage; // percentage of the whole book content
  }
}

module.exports = Bookmark;
