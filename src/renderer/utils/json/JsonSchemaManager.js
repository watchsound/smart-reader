/* eslint-disable prettier/prettier */
import Ajv from 'ajv';

class JsonSchemaManager {
  constructor() {
    this.ajv = new Ajv();
    this.schemas = {};
    this.validators = {};
  }

  // Method to register a schema with a given name
  registerSchema(name, schema) {
    this.schemas[name] = schema;
    this.validators[name] = this.ajv.compile(schema);
  }

  static mayContainsJsonData(content) {
    return content && content.indexOf('{') >=0 && content.indexOf('}') > 0;
  }

  // Method to find the matching schema for the given input JSON data
  findMatchSchema(inputJsonData) {
    for (const [name, validate] of Object.entries(this.validators)) {
      if (validate(inputJsonData)) {
        return name;
      }
    }
    return null;
  }
}

export default JsonSchemaManager;

// // Example usage
// const manager = new JsonSchemaManager();

// // Define sample schemas
// const schema1 = {
//   type: "object",
//   properties: {
//     type: { type: "string" },
//     data: { type: "object" }
//   },
//   required: ["type", "data"]
// };

// const schema2 = {
//   type: "object",
//   properties: {
//     category: { type: "string" },
//     content: { type: "array" }
//   },
//   required: ["category", "content"]
// };

// // Register schemas
// manager.registerSchema('schema1', schema1);
// manager.registerSchema('schema2', schema2);

// // Define input JSON data
// const inputJson1 = {
//   type: "exampleType",
//   data: { key: "value" }
// };

// const inputJson2 = {
//   category: "exampleCategory",
//   content: ["item1", "item2"]
// };

// // Find matching schemas
// console.log(manager.findMatchSchema(inputJson1)); // Output: schema1
// console.log(manager.findMatchSchema(inputJson2)); // Output: schema2
