const mindMapSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    root: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        children: {
          type: 'array',
          items: { $ref: '#/definitions/Node' },
        },
      },
      required: ['name', 'children'],
    },
  },
  required: ['root'],
  definitions: {
    Node: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        children: {
          type: 'array',
          items: { $ref: '#/definitions/Node' },
        },
      },
      required: ['name', 'children'],
    },
  },
};

export const mindMapSchema0 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'eReader Mind Map',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Title of the eReader mind map',
    },
    nodes: {
      type: 'array',
      description: 'List of nodes in the mind map',
      items: {
        $ref: '#/definitions/Node',
      },
    },
  },
  required: ['title', 'nodes'],
  definitions: {
    Node: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the node',
        },
        description: {
          type: 'string',
          description: 'Description of the node',
          default: '',
        },
        nodes: {
          type: 'array',
          description: 'List of child nodes',
          items: {
            $ref: '#/definitions/Node',
          },
          default: [],
        },
      },
      required: ['title'],
    },
  },
};

export default mindMapSchema;
