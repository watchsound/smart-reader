/* eslint-disable no-plusplus */
export const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};
export const removeExtraQuestionMark = (html: any) => {
  return html
    .replaceAll('–?', '–')
    .replaceAll('“?', '“')
    .replaceAll('”?', '”')
    .replaceAll('©?', '©')
    .replaceAll('’?', '’')
    .replaceAll('“?', '“')
    .replaceAll('…?', '…')
    .replaceAll('—?', '—')
    .replaceAll('‘?', '‘')
    .replaceAll('“?', '“');
};
export const copyArrayBuffer = (src) => {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
};

export const truncString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength)}...`;
};

export const isEmpty = (obj: any) => {
  // Check for null or undefined
  if (obj == null) {
    return true;
  }

  // Check for an empty string or the number 0
  if (typeof obj === 'string' || typeof obj === 'number') {
    return !obj;
  }

  // Check for an empty array
  if (Array.isArray(obj)) {
    return obj.length === 0;
  }

  // Optionally, if you want to check for empty objects as well
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }

  // For all other types, consider them not empty
  return false;
};

export const roundDecimals = (obj: any) => {
  // Iterate over each property of the object
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'number') {
      // Check if the property is a number
      // Round the number to two decimal places
      obj[key] = Math.round(obj[key] * 100) / 100;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Check if the property is an object
      // Call the function recursively on the nested object
      roundDecimals(obj[key]);
    }
  });
  return obj; // Return the modified object
}

export function truncateString(str: string, maxLength: number) {
  if (!str) return '';
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.substring(0, maxLength)}...`;
}


export const removeJsonFromContent = (response) => {
  let content = response.trim(); // .replace(/\n/g, '');

  function doJob(input) {
    const p0 = input.indexOf('```json');
    if (p0 < 0) return input;
    const p1 = input.indexOf('```', p0 + 7);
    if (p1 < 0) return input;
    const t0 = p0 === 0 ? '' : input.substring(0, p0);
    const t1 = p1 === input.length - 1 ? '' : input.substring(p1 + 3);
    return t0 + t1;
  }

  while (true) {
    const c = doJob(content);
    if (c.length === content.length) break;
    content = c;
  }
  return content;
};


export const stripJsonWrap = (response) => {
  const content = response.trim(); // .replace(/\n/g, '');
  const p0 = content.indexOf('```json');
  if (p0 < 0) {
    if (content.charAt(0) === '{' && content.charAt(content.length - 1) === '}')
      return content;
    return '';
  }
  const p1 = content.indexOf('```', p0 + 7);
  if (p1 < 0) {
    if (content.charAt(content.length - 1) === '}')
      return content.substring(p0 + 7).trim();
    return '';
  }
  if (p1 > p0) return content.substring(p0 + 7, p1).trim();
  return '';
};


export const stripJsonByTag = (response, startTag) => {
  const content = response.trim(); // .replace(/\n/g, '');
  // Escape any special characters in the keyword to safely include it in the regex
  const escapedKeyword = startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Create a new regex pattern using the provided keyword
  const regex = new RegExp(`\\{[\\s\\n]*"${escapedKeyword}"`);
  // Execute the regex on the input string
  const match = regex.exec(content);
  if (match) {
    const p0 = match.index;
    if (p0 < 0) {
      return '';
    }
    const p1 = content.lastIndexOf('}');
    if (p1 < 0 || p1 < p0) {
      return '';
    }
    return content.substring(p0, p1 + 1).trim();
  }
  return '';
};

export const stripSubstring = (response, startSymbol, endSymbol) => {
  const content = response.trim(); // .replace(/\n/g, '');
  const p0 = content.indexOf(startSymbol);
  if (p0 < 0) {
    return '';
  }
  const p1 = content.lastIndexOf(endSymbol);
  if (p1 < 0 || p1 < p0) {
    return '';
  }
  return content.substring(p0, p1 + endSymbol.length).trim();
};

export const removeStringFromContent = (input, needRemoved) => {
  const p0 = input.indexOf(needRemoved);
  if (p0 < 0) return input;
  if (p0 + needRemoved.length >= input.length) return input.substring(0, p0);
  return `${input.substring(0, p0)} ${input.substring(p0 + needRemoved.length)}`;
};


export const executeCommandWithRetry = async (command) => {
  let retryCount = 0;
  let response;
  while (retryCount < 5) {
    try {
      response = await command();
      if (response) {
        break; // Break if successful
      } else {
        console.log('Received an unsuccessful response, will retry:', response);
      }
    } catch (error) {
      console.log('Error encountered:', error);
      if (error.response && error.response.status === 429) {
        const delay = 2 ** retryCount * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log('Retrying after delay:', delay);
      } else {
        // Log and break on other errors
        console.error(
          'Non-retryable error or max retries reached, breaking:',
          error,
        );
        break;
      }
    }
    retryCount++;
  }
  return response;
};
