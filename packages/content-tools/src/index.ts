export type ContentToolResult = {
  message: string;
};

export function createContentToolResult(message: string): ContentToolResult {
  return { message };
}

export { caseContentRoot, casePath } from './paths.js';
export type { ValidationIssue } from './validate-case.js';
export {
  validateCaseForPublication,
  validateCollection,
} from './validate-case.js';
