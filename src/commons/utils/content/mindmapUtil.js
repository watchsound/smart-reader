/* eslint-disable prettier/prettier */
import { Position } from '@xyflow/react';

function isSymbolLine(content) {
  const line = content.trim();
  return (
    line === '"""' ||
    line === "'''" ||
    line === '```' ||
    line === '###' ||
    line === '""' ||
    line === "''" ||
    line === '``' ||
    line === '##' ||
    line === '"' ||
    line === "'" ||
    line === '`' ||
    line === '#'
  );
}

export function removeStartEndSymbolLines(content) {
  if (!content) return content;
  const lines = content.split('\n');
  const { length } = lines;
  if (length === 0) return content;
  const removeStart = isSymbolLine(lines[0]);
  const removeEnd = isSymbolLine(lines[length - 1]);
  if (removeStart && removeEnd) return lines.slice(1, -1).join('\n');
  if (removeStart) return lines.slice(1).join('\n');
  if (removeEnd) return lines.slice(0, -1).join('\n');
  return content;
}

// Detects the length of a list marker at the start of trimmed content.
// Recognises dash/asterisk/plus/bullet/middle-dot bullets, numbered lists
// (1. / 1) / (1) / 1)) and markdown headers (# / ## / …). Returns 0 when
// the content doesn't start with any recognised marker (i.e. probably prose
// preamble or a refusal — caller skips those).
//
// Replaces the previous `isAlphaNumeric` filter, which mis-rejected
// numbered-list lines like "1. Item" because '1' is alphanumeric.
function listMarkerLength(content) {
  if (!content) return 0;
  // Bullet markers: -, *, +, •, ·  (must be followed by space)
  const bulletMatch = content.match(/^([-*+•·])\s+/);
  if (bulletMatch) return bulletMatch[0].length;
  // Numbered list: "1. ", "1) ", "(1) "
  const numberedMatch = content.match(/^\(?\d+[.)]\s+/);
  if (numberedMatch) return numberedMatch[0].length;
  // Markdown headers: #, ##, ### (must be followed by space)
  const headerMatch = content.match(/^#{1,6}\s+/);
  if (headerMatch) return headerMatch[0].length;
  return 0;
}

function isListLine(content) {
  return listMarkerLength(content) > 0;
}

function calculateMiniStepForMindmap(lines) {
  // For each line: if it doesn't look like a mindmap list item, skip it.
  // Otherwise, track the minimum leading-whitespace column across indented
  // lines — that's the indentation step size.
  let min = 1000;
  lines.forEach((line) => {
    const content = line.trim();
    if (!content || content === 'mindmap' || content.indexOf('`') === 0) return;
    if (!isListLine(content)) return;
    const pos = line.indexOf(content);
    if (pos !== 0 && pos < min) min = pos;
  });
  return min === 1000 ? 0 : min;
}

// export function calculateMiniStep(lines, startSymbol) {
//   const startPos = [];
//   for (let i = 0; i < lines.length; i++) {
//     const line = lines[i];
//     startPos[i] = line.indexOf(startSymbol);
//   }
//   startPos.sort();
//   const prev = startPos[0];
//   for (let i = 1; i < startPos.length; i++) {
//     const pos = startPos[i];
//     if (prev !== pos) {
//       return pos - prev;
//     }
//   }
//   return 0;
// }
function getTextWidth(inputText, fontSize) {
  const font2 = `${fontSize || '22px'} times new roman`;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font2;
  return context.measureText(inputText).width;
}
function getValueRange(value, min, max) {
  if (value > max) return max;
  return value < min ? min : value;
}

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

function parseMindmapToReactFlowImp(
  markdown,
  lines,
  stepLength,
  useKeyword,
) {
  const nodes = [];
  const edges = [];
  const parentIdStack = [-1]; // Stack to keep track of parent nodes based on indentation level
  const parentIndents = [-1];
  let width = 0;
  let height = 0;
  let edgeId = 0;
  const fontSize = useKeyword ? '18px' : '20px';

  lines.forEach((line, index) => {
    const content = line.trim();
    if (
      content === 'mindmap' ||
      content.indexOf('`') === 0 ||
      content === ''
    ) {
      return; // Skip 'mindmap' directive and empty lines
    }
    const markerLen = listMarkerLength(content);
    if (markerLen === 0) {
      return; // Not a list item (preamble / prose / refusal)
    }

    let currentIndentation =
      stepLength === 0 ? 0 : line.indexOf(content) / stepLength; // Assuming 4 spaces per indentation level
    if (currentIndentation < 0) currentIndentation = 0;
    const id = `${index}`; // `node-${index}`;
    // Strip the bullet / number / header marker so the node text doesn't
    // include "- " or "1. " etc.
    let c = content.substring(markerLen);
    const sepPos = c.indexOf('|');
    if (sepPos > 0)
      c = useKeyword ? c.substring(0, sepPos) : c.replace('|', ' :: ');
    const node = {
      id,
      //  type: 'input',
      className: 'light',
      style: {
        background: '#D6D5E6',
        color: '#333',
        border: '1px solid #222138',
        margin: '4px',
        borderRadius: '2px',
        fontSize,
        width: getValueRange(
          getTextWidth(c, fontSize) + 10,
          useKeyword ? 50 : 140,
          useKeyword ? 80 : 300,
        ),
      },
      data: { label: c, detail: content },
      position: {
        x: 20 + currentIndentation * (useKeyword ? 120 : 260),
        y: 20 + index * (useKeyword ? 35 : 80),
      },
      ...nodeDefaults,
    };
    nodes.push(node);
    if (width < node.position.x + node.style.width) {
      width = node.position.x + node.style.width;
    }
    if (height < node.position.y) {
      height = node.position.y;
    }

    // Adjust the parentIdStack based on the current indentation
    while (
      parentIndents.length > 0 &&
      parentIndents[parentIndents.length - 1] >= currentIndentation
    ) {
      parentIdStack.pop();
      parentIndents.pop();
    }

    // Determine parent-child relationships
    if (parentIdStack.length !== 0) {
      const parentId = parentIdStack[parentIdStack.length - 1];
      const edge = {
        id: `el-${edgeId}`, // `e${parentId}-${id}`,
        source: parentId.toString(),
        target: id,
      };
      edges.push(edge);
      edgeId += 1;
    }

    // Update the stack with the current node's ID for future children
    // if (parentIdStack.length === currentIndentation) {
    //   parentIdStack.pop();
    // }
    parentIdStack.push(id);
    parentIndents.push(currentIndentation);
  });

  return { width, height, nodes, edges };
}

export default function parseMindmapToReactFlow(markdown) {
  if (!markdown) return {};
  const lines = markdown.split('\n');
  // const startSymbol = checkMindmapStartingSymbol(lines);
  const stepLength = calculateMiniStepForMindmap(lines);
  const keywordMap = parseMindmapToReactFlowImp(
    markdown,
    lines,
    stepLength,
    true,
  );
  const descriptionMap = parseMindmapToReactFlowImp(
    markdown,
    lines,
    stepLength,
    false,
  );
  return { keywordMap, descriptionMap };
}

const simpleMindMap = {
  root: {
    name: 'Main Topic',
    children: [
      {
        name: 'Subtopic 1',
        children: [
          {
            name: 'Sub-subtopic 1',
            children: [],
          },
          {
            name: 'Sub-subtopic 2',
            children: [],
          },
        ],
      },
      {
        name: 'Subtopic 2',
        children: [],
      },
    ],
  },
};

/**
const simpleMindMap = {
  root: {
    name: "Main Topic",
    children: [
      {
        name: "Subtopic 1",
        children: [
          {
            name: "Sub-subtopic 1",
            children: []
          },
          {
            name: "Sub-subtopic 2",
            children: []
          }
        ]
      },
      {
        name: "Subtopic 2",
        children: []
      }
    ]
  }
};
USAGE:

const { nodes, edges } = convertToReactFlow(simpleMindMap);

console.log("Nodes:", JSON.stringify(nodes, null, 2));
console.log("Edges:", JSON.stringify(edges, null, 2));
 *
 * @param {*} mindMap
 * @returns
 */
export const convertToReactFlow = (mindMap) => {
  const nodes = [];
  const edges = [];
  let idCounter = 1;

  const traverse = (node, parentId = null, depth = 0) => {
    const nodeId = idCounter.toString();
    idCounter += 1;

    nodes.push({
      id: nodeId,
      position: { x: depth * 200, y: nodes.length * 100 },
      data: { label: node.name },
    });

    if (parentId !== null) {
      edges.push({
        id: `e${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
      });
    }

    node.children.forEach((child) => traverse(child, nodeId, depth + 1));
  };

  traverse(mindMap.root);

  return { nodes, edges };
};

/**
 *
 * @param {const mindMap = {
  "title": "eReader",
  "nodes": [
    {
      "title": "Functional Interfaces",
      "nodes": [
        {
          "title": "Bookmarks",
          "description": "Allows users to save favorite pages",
          "nodes": [
            {
              "title": "Click Favorite",
              "description": "Initiates bookmarking process"
            },
            {
              "title": "Page Image Extraction",
              "description": "Extracts image from the page"
            }
          ]
        },
        {
          "title": "Web Page Reading",
          "description": "Allows reading web pages within the eReader"
        }
      ]
    }
  ]
};} input
 * @returns
 */
export const convertToReactFlow0 = (input) => {
  const nodes = [];
  const edges = [];
  let nodeIdCounter = 1;

  const traverse = (node, parentId = null, depth = 0) => {
    const nodeId = nodeIdCounter.toString();
    nodeIdCounter += 1;

    nodes.push({
      id: nodeId,
      position: { x: depth * 200, y: nodes.length * 100 },
      data: { label: node.title },
    });

    if (parentId !== null) {
      edges.push({
        id: `e${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
      });
    }

    if (node.nodes) {
      node.nodes.forEach((child) => traverse(child, nodeId, depth + 1));
    }
  };

  traverse(input);

  return { nodes, edges };
};
