export const DEFAULT_CUSTOM_PROMPT =
  'Based on the following file content, suggest a concise, descriptive filename (without extension, using lowercase and underscores). Only output the filename, nothing else.';

export const DEFAULT_FOLDER_PROMPT =
  "Based on the following file content, suggest a concise, descriptive relative folder path and filename (without extension, using lowercase and underscores) to categorize the file. VERY IMPORTANT: Separate folders with a forward slash (/) and MUST start with '{baseFolder}/'. e.g., '{baseFolder}/category/sub_category/descriptive_name'. Only output the relative path and filename, nothing else.";

export const LOCAL_PROVIDER_DEFAULTS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  llamacpp: 'http://localhost:8080/v1',
  jan: 'http://localhost:1337/v1',
  gpt4all: 'http://localhost:4891/v1',
  lmstudio: 'http://localhost:1234/v1',
};

export function defaultApiUrlForProvider(provider: string): string {
  return LOCAL_PROVIDER_DEFAULTS[provider] ?? '';
}

export function isDefaultLocalUrl(url: string | undefined): boolean {
  if (!url) return true;
  return Object.values(LOCAL_PROVIDER_DEFAULTS).includes(url);
}
