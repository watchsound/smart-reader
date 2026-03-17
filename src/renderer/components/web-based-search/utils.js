import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

export async function parseJsonFromLLM(content) {
  try {
    //  JSON.stringify(response.message.content);
    let jsonString = content;
    // Find the start and end indices of the JSON data within the content string
    const startIndex = content.indexOf('```json\n');
    if (startIndex >= 0) {
      const endIndex = content.indexOf('\n```', startIndex);
      jsonString = content.substring(startIndex + 8, endIndex); // +8 to skip "```json\n"
    }
    try {
      return JSON.parse(jsonString);
    } catch (jsonError) {
      console.error(
        'Invalid JSON received from LLM, escaping problematic tokens...',
      );
      const sanitizedContent = jsonString.replace(/\r?\n|\r/g, ''); // Remove line breaks
      // .replace(/\r?\n|\r/g, '')
      // .replace(/[^\x20-\x7E]+/g, '') // Remove non-ASCII characters
      // .replace(/\n/g, '')
      // .replace(/"/g, '\\"') // Escape double quotes
      // .replace(/\n/g, '\\n'); // Escape newlines

      console.log(` json str after sanitized = ${sanitizedContent}`);
      return JSON.parse(sanitizedContent);
    }
  } catch (error) {
    console.error('after sanitized, Error parsing JSON:', error);
    try {
      const st = await aiProviderManager.generateContent(
        `${JSON_FIX_JSON_PROMPT}\n\n${content}`,
      );
      console.log(` json str after sanitized = ${st}`);
      return JSON.parse(st);
    } catch (error2) {
      console.error('after LLM fix, Error parsing JSON:', error2);
    }
  }
  return null;
}

/**
 * Query Ollama with the constructed prompt.
 * @param {string} prompt - The prompt to provide to Ollama.
 * @returns {Promise<Object>} - The JSON response from Ollama.
 */
export async function queryOllamaWithReturnJson(prompt) {
  try {
    const history = [{ role: 'system', content: JSON_SYSTEM_PROMPT }];
    const response = await aiProviderManager.sendChatMessage(
      history,
      prompt,
      { maxOutputTokens: 8192 },
    );
    console.log(`response = ${JSON.stringify(response)}`);

    // const { content } = response.message;
    const r = await parseJsonFromLLM(response);
    if (r) return r;
  } catch (error) {
    console.error('Error querying Ollama:', error.message);
    // return { summary: "Failed to generate summary", sections: [] };
  }
  return null;
}

// Example usage:
// const inputString = "2. Science and Technology";
// const outputString = stripNumberAndDot(inputString);
// console.log(outputString); // Output: "Science and Technology"
export function stripNumberAndDot(str) {
  // Check if the string starts with a number followed by a dot
  if (/^\d+\./.test(str)) {
    // Remove the number and dot
    return str.slice(str.indexOf('.') + 1).trim();
  }
  // Return the original string if it doesn't start with a number and dot
  return str;
}

export function getClassificationPrompt(userInput, context) {
  return `
  Read the following article and determine the best format to represent its key points. Choose one of the following categories based on the nature of the content:

  timeline: Use if the content is historical or strongly tied to chronological events.
  numbered_steps: Use if the content is procedural, instructional, or step-by-step in nature.
  flowchart: Use if the content describes a process with decision points or branching paths.
  table: Use if the content fits well into rows and columns, representing structured data.
  network_graph: Use if the content describes interconnected entities and relationships.
  comparison_chart: Use if the content compares multiple items or concepts across various attributes.

  Article:
  ${userInput}

  ${context}


  ## Return your answer in the following JSON format, including a reason field that explains why you chose that classification:
{
  "classification": "timeline",
  "reason": "The article contains multiple historical events and dates in a chronological order."
}

if none of the categories fits the content, return:
{
  "classification": "",
  "reason": ""
}

  `;
}

export function getTimelinePrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is as a timeline. Please produce a JSON array of events in chronological order. Each event should be an object with the following fields:

  date: A string representing the date or time period of the event.
  title: A short, descriptive title for the event.
  description: An detailed explanation of what occurred during this event.
  location: Place where event happens.
  participants: Whoever participated in this event.

If exact dates are not available, provide approximate or descriptive time periods (e.g., 'Early 17th Century', 'Circa 1850').

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this format:

[
  {
    "date": "1450",
    "title": "Invention of the Printing Press",
    "description": "Johannes Gutenberg invents the printing press, revolutionizing the spread of information."
   "location": "Mainz, Germany",
    "participants": ["Johannes Gutenberg"]
  },
  {
    "date": "1492",
    "title": "Columbus's First Voyage",
    "description": "Christopher Columbus reaches the Americas, initiating extensive European exploration."
    "location": "Somewhere in the Caribbean",
    "participants": ["Christopher Columbus", "Crew members"]
    }
]
  `;
}

export function getMindMapPrompt(userInput, context) {
  return `
    Mind map is a popular way to visualize data. Please produce a JSON structure representing the main concept and its related ideas as nested subtopics. Each node should be an object with the following fields:

name: A string for the name of the concept or topic.
subtopics: An array of zero or more similarly structured objects.
If a topic has no further subtopics, use an empty array for subtopics.

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this example format:
{
  "name": "Sustainable Energy",
  "subtopics": [
    {
      "name": "Solar",
      "subtopics": [
        {
          "name": "Photovoltaic cells",
          "subtopics": []
        },
        {
          "name": "Solar thermal",
          "subtopics": []
        }
      ]
    },
    {
      "name": "Wind",
      "subtopics": [
        {
          "name": "Onshore wind farms",
          "subtopics": []
        },
        {
          "name": "Offshore wind farms",
          "subtopics": []
        }
      ]
    }
  ]
}
  `;
}

export function getHierarchicalOutlinePrompt(userInput, context) {
  return `
     You have determined that the best way to represent the article's content is as a hierarchical outline. Please produce a JSON structure representing the information as nested sections. Each section should be represented as an object with the following fields:

title: A string for the name or heading of the section.
subsections: An array of zero or more similarly structured objects, representing sub-levels in the outline.
If a section has no further subdivisions, use an empty array for subsections.

#Article:
${userInput}

${context}

#End of Article.


Return only the JSON data. Do not include extra commentary. Follow this example format:
{
  "title": "Technology Overview",
  "subsections": [
    {
      "title": "Hardware",
      "subsections": [
        {
          "title": "Computers",
          "subsections": []
        },
        {
          "title": "Mobile Devices",
          "subsections": []
        }
      ]
    },
    {
      "title": "Software",
      "subsections": [
        {
          "title": "Operating Systems",
          "subsections": []
        },
        {
          "title": "Applications",
          "subsections": []
        }
      ]
    }
  ]
}
  `;
}

export function getNumberedStepsPrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is as a set of numbered steps. Please produce a JSON array of steps, where each step is an object with the following fields:

stepNumber: An integer indicating the order of the step.
instruction: A short description of the action or guideline.
details: Additional information or clarification about how to perform the step (if applicable).

#Article:
${userInput}

${context}

#End of Article.


Return only the JSON data. Do not include extra commentary. Follow this example format:

[
  {
    "stepNumber": 1,
    "instruction": "Gather all required materials",
    "details": "Ensure you have tools, components, and safety gear ready."
  },
  {
    "stepNumber": 2,
    "instruction": "Prepare the workspace",
    "details": "Clear the area and wipe down surfaces to avoid contamination."
  },
  {
    "stepNumber": 3,
    "instruction": "Assemble the components",
    "details": "Follow the assembly guide and tighten all fasteners securely."
  }
]
  `;
}

export function getFlowchartPrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is  a process with decision points or branching paths. Please produce  JSON arrays of nodes and edges, with the following fields:

for nodes:
id:  id of the node.
type: type of then node, candidate value includes: start, process, decision, end
label: description of the node.

for edges:
from: id of the node that edge starts with.
to: id of the node that edge ends with.

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this example format:

 {
  "nodes": [
    { "id": "start", "type": "start", "label": "Start" },
    { "id": "verify_input", "type": "process", "label": "Verify Input Data" },
    { "id": "valid?", "type": "decision", "label": "Is Data Valid?" },
    { "id": "clean_data", "type": "process", "label": "Clean Data" },
    { "id": "process_data", "type": "process", "label": "Process Data" },
    { "id": "end", "type": "end", "label": "End" }
  ],
  "edges": [
    { "from": "start", "to": "verify_input" },
    { "from": "verify_input", "to": "valid?" },
    { "from": "valid?", "to": "clean_data", "condition": "No" },
    { "from": "valid?", "to": "process_data", "condition": "Yes" },
    { "from": "clean_data", "to": "verify_input" },
    { "from": "process_data", "to": "end" }
  ]
}

  `;
}

export function getTablePrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is a table as the content fits neatly into rows and columns.

  columns: an array of column names.
  rows: an array of row data, each row contains {column name : value} pairs.

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this example format:

{
  "columns": ["Name", "Population", "Capital"],
  "rows": [
    { "Name": "Country A", "Population": "10 million", "Capital": "Capital City A" },
    { "Name": "Country B", "Population": "20 million", "Capital": "Capital City B" }
  ]
}

  `;
}

export function getNetworkPrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is  a network involving entities and their relationships.. Please produce  JSON arrays of nodes and edges, with the following fields:

for nodes:
id:  id of the node.
label: description of the node.

for edges:
from: id of the node that edge starts with.
to: id of the node that edge ends with.
relationship: type of edge, the value maybe connected_to or associated_with

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this example format:

 {
  "nodes": [
    { "id": "node1", "label": "Node 1" },
    { "id": "node2", "label": "Node 2" },
    { "id": "node3", "label": "Node 3" }
  ],
  "edges": [
    { "from": "node1", "to": "node2", "relationship": "connected_to" },
    { "from": "node2", "to": "node3", "relationship": "associated_with" }
  ]
}

  `;
}

export function getComparisonChartPrompt(userInput, context) {
  return `
  You have determined that the best way to represent the article's content is Comparison Chart as the content compares multiple items or concepts across attributes.

#Article:
${userInput}

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. Follow this example format:
in this example, "name", "processor", "ram" and "storage" are all attributes for the item in comparison.

{
  "items": [
    {
      "name": "Laptop A",
      "processor": "Intel i5",
      "ram": "8GB",
      "storage": "256GB SSD"
    },
    {
      "name": "Laptop B",
      "processor": "Intel i7",
      "ram": "16GB",
      "storage": "512GB SSD"
    }
  ]
}

  `;
}

export function getMatchImagesToSectionsPrompt(sections, imageConcise) {
  return `
    For each section, assign the most appropriate image based on image's title and section's content(title and detail). Return a JSON array where each section contains a matched image.

    Sections:
    ${JSON.stringify(sections)}

    Images:
    ${JSON.stringify(imageConcise)}

    in output json data,
    "title":  is the title of section
    "image": is image assigned to this section, if no image found, use empty string.
    Example output:
    { "data":
      [
        {
          "title": "Introduction",
          "image":  {
              "id": 5,
              "title": "An introductory image",
            }
        },
        {
          "title": "Conclusion",
          "image": ""
        }
      ]
    }
  `;
}

export function getMatchImagesToTimelinePrompt(timelines, imageConcise) {
  return `
   Match the following images to the most appropriate sections based on their alt text, title, and context. Return a JSON array where each section contains an array of matched images.

    Sections:
    ${JSON.stringify(timelines)}

    Images:
    ${JSON.stringify(imageConcise)}

    Example output:
    [
      {
        "date": "1450",
        "title": "Invention of the Printing Press",
        "description": "Johannes Gutenberg invents the printing press, revolutionizing the spread of information."
        "location": "Mainz, Germany",
        "participants": ["Johannes Gutenberg"],
        "images": [
          {
            "src": "https://example.com/image1.jpg",
            "alt": "An introductory image",
            "title": "Intro Image",
            "context": "Text surrounding the image."
          }
        ]
      },
       {
        "date": "1492",
        "title": "Columbus's First Voyage",
        "description": "Christopher Columbus reaches the Americas, initiating extensive European exploration."
        "location": "Somewhere in the Caribbean",
        "participants": ["Christopher Columbus", "Crew members"],
        "images": []
        }
    ]
  `;
}

export function getMatchImagesToNumberedStepsPrompt(timelines, imageConcise) {
  return `
   Match the following images to the most appropriate sections based on their alt text, title, and context. Return a JSON array where each section contains an array of matched images.

    Sections:
    ${JSON.stringify(timelines)}

    Images:
    ${JSON.stringify(imageConcise)}

    Example output:
    [
      {
        "stepNumber": 1,
        "instruction": "Gather all required materials",
        "details": "Ensure you have tools, components, and safety gear ready.",
        "images": [
          {
            "src": "https://example.com/image1.jpg",
            "alt": "An introductory image",
            "title": "Intro Image",
            "context": "Text surrounding the image."
          }
        ]
      },
      {
        "stepNumber": 2,
        "instruction": "Prepare the workspace",
        "details": "Clear the area and wipe down surfaces to avoid contamination.",
        "images": []
      },
    ]
  `;
}

export function getMatchImagesToMindMapPrompt(timelines, imageConcise) {
  return `
   Match the following images to the most appropriate sections based on their alt text, title, and context. Return a JSON array where each section contains an array of matched images.

    Sections:
    ${JSON.stringify(timelines)}

    Images:
    ${JSON.stringify(imageConcise)}

    Example output:
    {
      "name": "Sustainable Energy",
      "images": [
            {
              "src": "https://example.com/image1.jpg",
              "alt": "An introductory image",
              "title": "Intro Image",
              "context": "Text surrounding the image."
            }
          ]
      "subtopics": [
        {
          "name": "Solar",
          "images": [],
          "subtopics": [
            {
              "name": "Photovoltaic cells",
              "images": [],
              "subtopics": []
            },
            {
              "name": "Solar thermal",
              "images": [],
              "subtopics": []
            }
          ]
        },
        {
          "name": "Wind",
          "images": [],
          "subtopics": [
            {
              "name": "Onshore wind farms",
               "images": [],
              "subtopics": []
            },
            {
              "name": "Offshore wind farms",
               "images": [],
              "subtopics": []
            }
          ]
        }
      ]
    }

  `;
}

export function getTapToRevealPrompt(userInput, context) {
  return `
  I have a paragraph of text. Based on the content of this paragraph, create two quiz problems to test the reader's understanding around the question: ${userInput}. Provide your output in JSON format, where each quiz problem has a title, a question, and an answer. Do not include any explanation or additional text outside the JSON data. Here is the JSON format to follow:

  {
    "data" :
    [
      {
        "title": "Title of the first quiz problem",
        "question": "What is the first question based on the content?",
        "answer": "Correct answer to the first question"
      },
      {
        "title": "Title of the second quiz problem",
        "question": "What is the second question based on the content?",
        "answer": "Correct answer to the second question"
      }
    ]
  }

the article is used to answer the question: ${userInput}
#Article:

${context}

#End of Article.

Return only the JSON data. Do not include extra commentary. ensure that the questions directly test the understanding of the paragraph provided.

  `;
}

export function getRelatedTopicsPrompt(userInput) {
  return `
  Given the following user input, generate a list of 3-5 suggested subtopics or areas of exploration that delve deeper into the main topic.

User Input: ${userInput}

The suggested subtopics should be concise, informative, and logically related to the main topic, encouraging further learning and exploration.
Provide your output in JSON format, where each quiz problem has a title, a question, and an answer. Do not include any explanation or additional text outside the JSON data. Here is the JSON format to follow:

{
  "suggested_subtopics": [
    "Subtopic 1",
    "Subtopic 2",
    "Subtopic 3",
  ]
}

  `;
}


export function getVocabularyPrompt(context) {
  return `
  "instruction: "Given the following paragraph, extract one less frequent or uncommon word that is directly relevant to the main topic or key concept(s) presented.
  Provide the word itself.
  Provide its definition in at least 60 words, ensuring it is clear and concise.
  Provide three example sentences demonstrating the word's usage in different contexts.
  Return the information in the following JSON format:

  {
    "word": "<extracted_word>",
    "definition": "<detailed_definition>",
    "examples": ["<example_sentence_1>", "<example_sentence_2>", "<example_sentence_3>"]
  }

  ${JSON_SYSTEM_PROMPT}
  If no suitable word can be found, return an empty JSON object: {}.",
  "paragraph":
  ${context}

  `;
}

export const JSON_SYSTEM_PROMPT =
  ' You must produce only valid JSON. Do not include any additional text, explanations, or comments. Do not prefix the JSON with any text. Do not suffix the JSON with any text. Simply provide the complete and valid JSON object.';

export const MARKDOWN_SYSTEM_PROMPT =
  'You must produce only valid markdown. Do not include any additional text, explanations, or comments. Do not prefix the markdown with any text. Do not suffix the markdown with any text.';

export const JSON_FIX_JSON_PROMPT = `
I have a piece of JSON data that may contain format issues, such as missing commas, quotation marks, brackets, or ending tags. Your task is to analyze the JSON data, identify any errors, and return the corrected JSON data.

If the JSON data is already valid and has no errors, simply return the original JSON data as it is. Do not include explanations or comments in your response—only provide the corrected JSON or the original JSON.

Here is the JSON data:
`;
