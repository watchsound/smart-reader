const algebraSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Generated schema for Root',
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step: {
            type: 'number',
          },
          'math-expression': {
            type: 'string',
          },
          explain: {
            type: 'string',
          },
        },
        required: ['step', 'math-expression', 'explain'],
      },
    },
  },
  required: ['steps'],
};

export default algebraSchema;
