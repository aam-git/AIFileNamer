const {
  DEFAULT_CUSTOM_PROMPT,
  DEFAULT_FOLDER_PROMPT,
  LOCAL_OPENAI_COMPAT,
  defaultApiUrlForProvider,
  resolveLocalBaseUrl,
} = require('./aiDefaults.cjs');

async function parseApiError(response, provider) {
  let errorMsg = `${response.status} ${response.statusText}`;
  try {
    const errorData = await response.json();
    if (errorData.error && errorData.error.message) {
      errorMsg = errorData.error.message;
    } else if (errorData.message) {
      errorMsg = errorData.message;
    } else {
      errorMsg = JSON.stringify(errorData);
    }
  } catch (e) {
    try {
      const text = await response.text();
      if (text) errorMsg = text.substring(0, 200);
    } catch(e2) {
      console.error("Failed to parse error response text:", e2);
    }
  }
  throw new Error(`${provider} error: ${errorMsg}`);
}

function sanitizeLog(payload) {
  try {
    const safe = JSON.parse(JSON.stringify(payload));
    if (safe.messages) {
      safe.messages.forEach(m => {
        if (Array.isArray(m.content)) {
          m.content.forEach(c => {
            if (c.type === 'image_url' && c.image_url && c.image_url.url) c.image_url.url = '[BASE64_IMAGE_DATA_REMOVED]';
            if (c.type === 'image' && c.source && c.source.data) c.source.data = '[BASE64_IMAGE_DATA_REMOVED]';
          });
        }
      });
    }
    if (safe.contents) {
      safe.contents.forEach(c => {
        if (c.parts) {
          c.parts.forEach(p => {
            if (p.inlineData && p.inlineData.data) p.inlineData.data = '[BASE64_IMAGE_DATA_REMOVED]';
          });
        }
      });
    }
    return safe;
  } catch (e) { 
    console.error("Failed to sanitize log payload:", e);
    return payload; 
  }
}

function parseAIOutput(rawOutput) {
  let clean = rawOutput.trim();
  // Remove markdown code blocks if the AI wrapped the response
  clean = clean.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
  clean = clean.replace(/`/g, '');
  // Strip any file extension the AI might have included at the end (e.g. .jpg, .pdf)
  clean = clean.replace(/\.[a-z0-9]{2,5}$/i, '');
  // Replace spaces with underscores and convert to lowercase
  return clean.trim().replace(/ /g, '_').toLowerCase();
}

async function handleTokenRetry(response, payload, url, headers) {
  if (response.status === 400) {
    const clonedRes = response.clone();
    try {
      const errData = await clonedRes.json();
      const errMsg = errData?.error?.message || '';
      if (errMsg.includes("max_tokens") && errMsg.includes("max_completion_tokens")) {
        delete payload.max_tokens;
        delete payload.temperature;
        payload.max_completion_tokens = 8192;
        return await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }
    } catch (e) {
      console.error("Failed to parse token retry error response:", e);
    }
  }
  return response;
}

async function generateFilename(providerConfig, fileMeta, extractedContent, appSettings) {
  let prompt = appSettings?.customPrompt || DEFAULT_CUSTOM_PROMPT;

  if (appSettings?.suggestFolders) {
    let baseFolder = extractedContent?.type === 'image' ? 'images' : 'documents';
    prompt = (appSettings?.customFolderPrompt || DEFAULT_FOLDER_PROMPT).replace(/{baseFolder}/g, baseFolder);
  }

  let cleanOriginalName = '';
  if (extractedContent?.metadataString) {
    let originalNameNoExt = fileMeta.name.substring(0, fileMeta.name.lastIndexOf('.')) || fileMeta.name;
    cleanOriginalName = originalNameNoExt.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
    cleanOriginalName = cleanOriginalName.replace(/^_|_$/g, '');

    prompt += `\n\nCRITICAL INSTRUCTION: The following metadata is provided to ENRICH your understanding. Your primary source of truth MUST ALWAYS be the visual or text content of the file. Ensure the final filename is NATURAL, CONCISE, and UNIQUE. ABSOLUTELY DO NOT repeat words (e.g. never output 'map_map' or 'image_image'). Ensure your final output is just the filename, lowercased with underscores, and NOT repetitive.\n`;
    prompt += extractedContent.metadataString;
  }

  let result;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      if (providerConfig.provider === 'ollama') {
        result = await callOllama(providerConfig, prompt, extractedContent);
      } else if (providerConfig.provider === 'openai') {
        result = await callOpenAI(providerConfig, prompt, extractedContent);
      } else if (['lmstudio', 'llamacpp', 'jan', 'gpt4all'].includes(providerConfig.provider)) {
        result = await callLMStudio(providerConfig, prompt, extractedContent);
      } else if (providerConfig.provider === 'groq' || providerConfig.provider === 'deepseek') {
        result = await callOpenAILikeCloud(providerConfig, prompt, extractedContent);
      } else if (providerConfig.provider === 'anthropic') {
        result = await callAnthropic(providerConfig, prompt, extractedContent);
      } else if (providerConfig.provider === 'gemini' || providerConfig.provider === 'aistudio') {
        result = await callGemini(providerConfig, prompt, extractedContent);
      } else if (providerConfig.provider === 'openrouter') {
        result = await callOpenRouter(providerConfig, prompt, extractedContent);
      } else {
        throw new Error(`Unknown provider: ${providerConfig.provider}`);
      }
      
      break; // Success
    } catch (err) {
      if (
        attempts === 0 && 
        extractedContent?.textContent && 
        err.message && 
        (err.message.toLowerCase().includes('context size') || err.message.toLowerCase().includes('token limit') || err.message.toLowerCase().includes('context_length') || err.message.toLowerCase().includes('too long'))
      ) {
        // Fallback: slice the text in half and retry once
        extractedContent.textContent = extractedContent.textContent.substring(0, Math.floor(extractedContent.textContent.length / 2));
        attempts++;
        continue;
      }
      
      if (err.aiLog && extractedContent?.events) {
        err.aiLog.events = extractedContent.events;
      }
      throw err;
    }
  }

  if (result && result.aiLog && extractedContent?.events) {
    result.aiLog.events = extractedContent.events;
  }
  
  if (result && result.proposedName && cleanOriginalName) {
    // Exclude purely generic original names from forcing a suffix
    const genericNames = ['image', 'photo', 'scan', 'document', 'untitled', 'file', 'img', 'pic'];
    const isGeneric = genericNames.some(g => cleanOriginalName.startsWith(g) && cleanOriginalName.replace(g, '').match(/^[0-9_]*$/));
    
    if (!isGeneric && !result.proposedName.includes(cleanOriginalName)) {
      result.proposedName = `${result.proposedName}_${cleanOriginalName}`;
    }
  }

  return result;
}


async function fetchModels(config) {
  try {
    if (config.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      });
      if (!res.ok) throw new Error('Invalid API Key');
      const data = await res.json();
      return { success: true, models: data.data.map(m => m.id) };
    }
    
    if (LOCAL_OPENAI_COMPAT.has(config.provider)) {
      const baseUrl = resolveLocalBaseUrl(config);
      
      const res = await fetch(`${baseUrl}/models`);
      if (!res.ok) throw new Error(`Could not connect to Local Server`);
      const data = await res.json();
      if (!data || !data.data) throw new Error('Invalid response format. Check if server is running.');
      return { success: true, models: data.data.map(m => m.id) };
    }

    if (config.provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      });
      if (!res.ok) throw new Error('Invalid API Key');
      const data = await res.json();
      return { success: true, models: data.data.map(m => m.id) };
    }

    if (config.provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Invalid API Key');
      const data = await res.json();
      return { success: true, models: data.data.map(m => m.id) };
    }

    if (config.provider === 'ollama') {
      const url = `${resolveLocalBaseUrl(config) || defaultApiUrlForProvider('ollama')}/api/tags`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not connect to Ollama');
      const data = await res.json();
      return { success: true, models: data.models.map(m => m.name) };
    }

    if (config.provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error('Could not fetch OpenRouter models');
      const data = await res.json();
      return { success: true, models: data.data.map(m => m.id) };
    }

    if (config.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
      });
      if (!res.ok) throw new Error('Invalid API Key');
      const data = await res.json();
      return { success: true, models: data.data.map(m => m.id) };
    }

    if (config.provider === 'gemini' || config.provider === 'aistudio') {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': config.apiKey, 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Invalid API Key');
      const data = await res.json();
      return { success: true, models: data.models.map(m => m.name.replace('models/', '')) };
    }

    return { success: false, error: 'Unknown provider' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function callOllama(config, prompt, content) {
  const url = `${resolveLocalBaseUrl(config) || defaultApiUrlForProvider('ollama')}/api/generate`;
  
  let payload = { model: config.model || 'llama3', stream: false };
  
  if (content.type === 'text') {
    payload.prompt = `${prompt}\n\nContent:\n${content.content}`;
  } else if (content.type === 'image') {
    payload.prompt = prompt;
    payload.images = [content.content];
  }

  let responseBody = null;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) await parseApiError(response, 'Ollama');
    const data = await response.json();
    responseBody = data;
    const contentString = data.response || '';
    const proposedName = parseAIOutput(contentString);
    
    return { 
      proposedName, 
      aiLog: { provider: 'Ollama', url, request: sanitizeLog(payload), response: responseBody } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'Ollama', url, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callOpenAI(config, prompt, content) {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  let messages = [];
  if (content.type === 'text') {
    const fileText = content.content.trim() ? content.content : "(empty file)";
    messages = [
      { role: 'user', content: `${prompt}\n\nFile Content:\n${fileText}` }
    ];
  } else if (content.type === 'image') {
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${content.mime};base64,${content.content}` } }
        ]
      }
    ];
  }

  const model = config.model || (content.type === 'image' ? 'gpt-4o' : 'gpt-4o-mini');
  let payload = { model, messages };
  if (model.includes('o1') || model.includes('o3')) {
    payload.max_completion_tokens = 8192;
    payload.reasoning_effort = "low";
  } else {
    payload.max_tokens = 8192;
    payload.temperature = 0.3;
  }
  
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify(payload)
    });
    
    // Auto-retry if we guessed the wrong token parameter for a new model
    response = await handleTokenRetry(response, payload, url, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` });
    
    if (!response.ok) await parseApiError(response, 'OpenAI');
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    
    const contentString = data.choices[0]?.message?.content || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response. (Reasoning tokens exhausted?)");
    
    return { 
      proposedName, 
      aiLog: { provider: 'OpenAI', url, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'OpenAI', url, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callLMStudio(config, prompt, content) {
  const baseUrl = resolveLocalBaseUrl(config);
  const url = `${baseUrl}/chat/completions`;
  
  let messages = [];
  if (content.type === 'text') {
    const fileText = content.content.trim() ? content.content : "(empty file)";
    messages = [
      { role: 'user', content: `${prompt}\n\nFile Content:\n${fileText}` }
    ];
  } else if (content.type === 'image') {
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${content.mime};base64,${content.content}` } }
        ]
      }
    ];
  }

  const model = config.model || 'local-model';
  let payload = { model, messages };
  if (model.includes('o1') || model.includes('o3')) {
    payload.max_completion_tokens = 8192;
  } else {
    payload.max_tokens = 8192;
    payload.temperature = 0.3;
  }
  
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    // Auto-retry if we guessed the wrong token parameter for a new model
    response = await handleTokenRetry(response, payload, url, { 'Content-Type': 'application/json' });
    
    if (!response.ok) await parseApiError(response, 'LM-Studio');
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    
    const contentString = data.choices[0]?.message?.content || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response. (Reasoning tokens exhausted?)");
    
    return { 
      proposedName, 
      aiLog: { provider: 'LM-Studio', url, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'LM-Studio', url, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callOpenRouter(config, prompt, content) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  let messages = [];
  if (content.type === 'text') {
    const fileText = content.content.trim() ? content.content : "(empty file)";
    messages = [
      { role: 'user', content: `${prompt}\n\nFile Content:\n${fileText}` }
    ];
  } else if (content.type === 'image') {
    messages = [
      { role: 'user', content: [ { type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${content.mime};base64,${content.content}` } } ] }
    ];
  }

  const model = config.model || 'google/gemini-flash-1.5';
  let payload = { model, messages };
  if (model.includes('o1') || model.includes('o3')) {
    payload.max_completion_tokens = 8192;
    payload.reasoning_effort = "low";
  } else {
    payload.max_tokens = 8192;
    payload.temperature = 0.3;
  }
  
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify(payload)
    });
    
    // Auto-retry if we guessed the wrong token parameter for a new model
    response = await handleTokenRetry(response, payload, url, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` });
    
    if (!response.ok) await parseApiError(response, 'OpenRouter');
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!data.choices || !data.choices[0]) throw new Error("Invalid response format from OpenRouter: " + JSON.stringify(data));
    
    const contentString = data.choices[0]?.message?.content || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response. (Reasoning tokens exhausted?)");
    
    return { 
      proposedName, 
      aiLog: { provider: 'OpenRouter', url, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'OpenRouter', url, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callAnthropic(config, prompt, content) {
  const url = 'https://api.anthropic.com/v1/messages';
  
  let messages = [];
  if (content.type === 'text') {
    messages = [ { role: 'user', content: `${prompt}\n\nFile Content:\n${content.content}` } ];
  } else if (content.type === 'image') {
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: content.mime, data: content.content } }
        ]
      }
    ];
  }

  const model = config.model || 'claude-3-haiku-20240307';
  const payload = { model, max_tokens: 4096, temperature: 0.3, messages };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) await parseApiError(response, 'Anthropic');
    const data = await response.json();
    const contentString = data.content?.[0]?.text || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response. (Try a non-reasoning model or check token limits)");
    
    return { 
      proposedName, 
      aiLog: { provider: 'Anthropic', url, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'Anthropic', url, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callGemini(config, prompt, content) {
  let model = config.model;
  if (!model) {
    model = content.type === 'image' ? 'gemini-1.5-flash' : 'gemini-1.5-flash';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  let parts = [];
  if (content.type === 'text') {
    parts = [{ text: `${prompt}\n\nContent:\n${content.content}` }];
  } else if (content.type === 'image') {
    parts = [
      { text: prompt },
      { inlineData: { mimeType: content.mime, data: content.content } }
    ];
  }

  const payload = { contents: [{ parts }] };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) await parseApiError(response, 'Gemini');
    const data = await response.json();
    const contentString = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response. (Try a non-reasoning model or check token limits)");
    
    return { 
      proposedName, 
      aiLog: { provider: 'Gemini', url: `Gemini API: ${model}`, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: 'Gemini', url: `Gemini API: ${model}`, request: sanitizeLog(payload), error: err.message } });
  }
}

async function callOpenAILikeCloud(config, prompt, content) {
  let url = '';
  let providerName = '';
  if (config.provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    providerName = 'Groq';
  } else if (config.provider === 'deepseek') {
    url = 'https://api.deepseek.com/chat/completions';
    providerName = 'DeepSeek';
  }

  let messages = [];
  if (content.type === 'text') {
    const fileText = content.content.trim() ? content.content : "(empty file)";
    messages = [
      { role: 'user', content: `${prompt}\n\nFile Content:\n${fileText}` }
    ];
  } else if (content.type === 'image') {
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${content.mime};base64,${content.content}` } }
        ]
      }
    ];
  }

  const model = config.model;
  let payload = { model, messages, max_tokens: 8192, temperature: 0.3 };
  
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify(payload)
    });
    
    response = await handleTokenRetry(response, payload, url, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` });
    
    if (!response.ok) await parseApiError(response, providerName);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!data.choices || !data.choices[0]) throw new Error(`Invalid response format from ${providerName}: ` + JSON.stringify(data));
    
    const contentString = data.choices[0]?.message?.content || '';
    const proposedName = parseAIOutput(contentString);
    if (!proposedName) throw new Error("AI returned an empty response.");
    
    return { 
      proposedName, 
      aiLog: { provider: providerName, url, request: sanitizeLog(payload), response: data } 
    };
  } catch (err) {
    throw Object.assign(err, { aiLog: { provider: providerName, url, request: sanitizeLog(payload), error: err.message } });
  }
}

module.exports = { generateFilename, fetchModels };
