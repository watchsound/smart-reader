// code is modified from koodo reader
class Book {
  constructor(
    id,
    keyInStorage,
    idFromServer,
    name,
    subtitle,
    author,
    description,
    cover,
    format,
    publisher,
    category,
    size,
    path,
    charset,
    createdAt,
    favorite,
    bookShelfId,
  ) {
    this.id = id;
    this.keyInStorage = keyInStorage;
    this.idFromServer = idFromServer;
    this.name = name;
    this.subtitle = subtitle;
    this.author = author;
    this.description = description;
    this.cover = cover;
    this.format = format;
    this.publisher = publisher;
    this.category = category;
    this.size = size;
    this.path = path;
    this.charset = charset;
    this.createdAt = createdAt;
    this.favorite = !!favorite;
    this.bookShelfId = bookShelfId || -1;
  }
}

module.exports = Book;
