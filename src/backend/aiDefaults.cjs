const DEFAULT_CUSTOM_PROMPT =
  'Based on the following file content, suggest a concise, descriptive filename (without extension, using lowercase and underscores). Only output the filename, nothing else.';

const DEFAULT_FOLDER_PROMPT =
  "Based on the following file content, suggest a concise, descriptive relative folder path and filename (without extension, using lowercase and underscores) to categorize the file. VERY IMPORTANT: Separate folders with a forward slash (/) and MUST start with '{baseFolder}/'. e.g., '{baseFolder}/category/sub_category/descriptive_name'. Only output the relative path and filename, nothing else.";

const LOCAL_PROVIDER_DEFAULTS = {
  ollama: 'http://localhost:11434',
  llamacpp: 'http://localhost:8080/v1',
  jan: 'http://localhost:1337/v1',
  gpt4all: 'http://localhost:4891/v1',
  lmstudio: 'http://localhost:1234/v1',
};

const LOCAL_OPENAI_COMPAT = new Set(['lmstudio', 'llamacpp', 'jan', 'gpt4all']);

function defaultApiUrlForProvider(provider) {
  return LOCAL_PROVIDER_DEFAULTS[provider] ?? '';
}

function resolveLocalBaseUrl(config) {
  let baseUrl = config.apiUrl;
  if (!baseUrl) {
    baseUrl = defaultApiUrlForProvider(config.provider);
  }
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  return baseUrl;
}

module.exports = {
  DEFAULT_CUSTOM_PROMPT,
  DEFAULT_FOLDER_PROMPT,
  LOCAL_PROVIDER_DEFAULTS,
  LOCAL_OPENAI_COMPAT,
  defaultApiUrlForProvider,
  resolveLocalBaseUrl,
};
