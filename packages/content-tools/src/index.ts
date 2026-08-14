export type ContentToolResult = {
  message: string;
};

export function createContentToolResult(message: string): ContentToolResult {
  return { message };
}
