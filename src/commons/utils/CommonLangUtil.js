/* eslint-disable no-restricted-syntax */


function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === '[object Object]'
}

export function isPlainObject(o) {
  if (!hasObjectPrototype(o)) {
    return false
  }

  // If has modified constructor
  const ctor = o.constructor
  if (typeof ctor === 'undefined') {
    return true
  }

  // If has modified prototype
  const prot = ctor.prototype
  if (!hasObjectPrototype(prot)) {
    return false
  }

  // If constructor does not have an Object-specific method
  if (!prot.hasOwnProperty('isPrototypeOf')) {
    return false
  }

  // Most likely a plain Object
  return true
}

export function splitTextIntoChunks(text, chunkSize = 200) {
  const chunks = [];
  let currentChunk = '';
  if (!text) return chunks;
  // Split text into sentences considering that some periods do not indicate the end of a sentence
  const sentenceRegex = /(?<!\b\w{1,3}\.)(?<!\b\w+\.\w+\.)[\.!\?]["']?\s+|\n+/g;
  const sentences = text.split(sentenceRegex);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= chunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      if (sentence.length <= chunkSize) {
        currentChunk = sentence;
      } else {
        const words = sentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if (tempChunk.length + word.length + 1 <= chunkSize) {
            tempChunk += (tempChunk ? ' ' : '') + word;
          } else {
            chunks.push(tempChunk.trim());
            tempChunk = word;
          }
        }
        currentChunk = tempChunk;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function findMinMaxInObject(obj) {
  let min = Infinity;
  let max = -Infinity;

  function recurse(currentObj) {
    for (const key in currentObj) {
      if (typeof currentObj[key] === 'number') {
        // Update max and min if the current value is a number
        if (currentObj[key] > max) max = currentObj[key];
        if (currentObj[key] < min) min = currentObj[key];
      } else if (
        typeof currentObj[key] === 'object' &&
        currentObj[key] !== null
      ) {
        // Recurse if the property is an object
        recurse(currentObj[key]);
      }
    }
  }

  recurse(obj);
  return { max, min };
}

export function scaleObject(obj, scale, skippedProp, forceInt) {
  function recurse(currentObj) {
    for (const key in currentObj) {
      if (skippedProp.includes(key)) continue;
      if (typeof currentObj[key] === 'number') {
        // Update max and min if the current value is a number
        currentObj[key] = forceInt
          ? parseInt(currentObj[key] * scale)
          : currentObj[key] * scale;
      } else if (
        typeof currentObj[key] === 'object' &&
        currentObj[key] !== null
      ) {
        // Recurse if the property is an object
        recurse(currentObj[key]);
      }
    }
  }
  recurse(obj);
}

export function shiftObject(obj, offset, skippedProp, forceInt) {
  function recurse(currentObj) {
    for (const key in currentObj) {
      if (skippedProp.includes(key)) continue;
      if (typeof currentObj[key] === 'number') {
        // Update max and min if the current value is a number
        currentObj[key] = forceInt
          ? parseInt(currentObj[key] + offset)
          : currentObj[key] + offset;
      } else if (
        typeof currentObj[key] === 'object' &&
        currentObj[key] !== null
      ) {
        // Recurse if the property is an object
        recurse(currentObj[key]);
      }
    }
  }
  recurse(obj);
}

export function getFirstNMinusTailItems(arr, numDelete = 2) {
  if (!arr) return [];
  const n = arr.length;
  if (n <= numDelete) {
    return arr;
  }
  return arr.slice(0, n - numDelete);
}

export function mapToPredefinedColor(inputString) {
  // Array of predefined strings
  const predefinedColors = [
    '#DE3163',
    '#FF7F50',
    '#FFBF00',
    '#CCCCFF',
    '#6495ED',
    '#40E0D0',
    '#9FE2BF',
    '#34568B',
    '#FF6F61',
    '#6B5B95',
    '#88B04B',
    '#955251',
    '#B565A7',
    '#009B77',
    '#FFFF00',
  ];
  if (!inputString) return predefinedColors[0];

  // Simple hash function to map the input string to an index
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  // Calculate the index using the hash function and modulo
  const index =
    Math.abs(hashString(inputString.trim())) % predefinedColors.length;
  console.log(` input = ${inputString}  colorIndex = ${index}`);
  // Return the corresponding predefined string
  return predefinedColors[index];
}
