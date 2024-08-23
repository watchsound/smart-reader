/* eslint-disable prettier/prettier */
/* eslint-disable no-await-in-loop */
const getSearchTermCoordinates = async (page, searchTerm) => {
  const textContent = await page.getTextContent();
  const coordinates = [];
  let x1 = 100000;
  let y1 = 100000;
  let x2 = 0;
  let y2 = 0
  textContent.items.forEach((item, index) => {
    if (item.str.includes(searchTerm)) {
      const { transform, width, height } = item;
      const [x, y, rotateX, rotateY, scaleX, scaleY] = transform;

      if (x1 < x) x1 = x;
      if (y1 < y) y1 = y;
      if (x + width > x2) x2 = x + width;
      if (y + height > y2) y2 = y + height;
      coordinates.push({
        x1: x,
        y1: y,
        x2: x + width,
        y2: y + height,
        width,
        height,
      });
    }
  });

  return  {
    boundingRect: {
      x1, y1, x2, y2, width: x2 - x1, height: y2 - y1, pageNumber: page.pageNumber,
    },
    rects: coordinates,
    pageNumber: page.pageNumber,
  };
};

const searchPdfText = async (pdfDocument, searchTerm) => {
  const { numPages } = pdfDocument;
  const searchResults = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');

    if (pageText.includes(searchTerm)) {
      searchResults.push({
        id: String(i),
        pageNumber: i,
        content: { text: pageText },
        isFromTextSearch: true,
        isPDF: true,
        searchTerm,
        comment : {
          text: '',
        },
        position: await getSearchTermCoordinates(page, searchTerm),
      });
    }
  }

  return searchResults;
};

export default searchPdfText;
