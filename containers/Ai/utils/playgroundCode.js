/**
 * Code snippets ("View Code") for the AI playground, mirroring GPUStack's
 * playground (curl / Python / Node.js).
 */

function jsonText (payload) {
  return JSON.stringify(payload, null, 2)
}

export function buildEmbeddingPayload ({ model, input, dimensions, encodingFormat } = {}) {
  const payload = {
    model: model || 'your-model',
    input: Array.isArray(input) && input.length ? input : ['hello world'],
  }
  if (dimensions > 0) payload.dimensions = dimensions
  if (encodingFormat) payload.encoding_format = encodingFormat
  return payload
}

export function buildRerankPayload ({ model, query, documents, topN, returnDocuments } = {}) {
  const payload = {
    model: model || 'your-model',
    query: query || 'hello',
    documents: Array.isArray(documents) && documents.length ? documents : ['hello', 'world'],
  }
  if (topN > 0) payload.top_n = topN
  if (typeof returnDocuments === 'boolean') payload.return_documents = returnDocuments
  return payload
}

export function buildCodeSnippets ({ endpoint, virtualKey = '<API Key>', payload, kind = 'embeddings' } = {}) {
  const url = endpoint || '<endpoint>'
  const key = virtualKey || '<API Key>'
  const body = payload || {}
  const baseUrl = url.replace(/\/[^/]+$/, '')
  const python = kind === 'rerank'
    ? [
      'import requests',
      '',
      `resp = requests.post('${url}',`,
      `  headers={'Authorization': 'Bearer ${key}', 'Content-Type': 'application/json'},`,
      `  json=${jsonText(body).replace(/\n/g, '\n  ')})`,
      'print(resp.json())',
    ].join('\n')
    : [
      'from openai import OpenAI',
      '',
      `client = OpenAI(base_url="${baseUrl}", api_key="${key}")`,
      'resp = client.embeddings.create(',
      `    model="${body.model || 'your-model'}",`,
      `    input=${JSON.stringify(body.input || ['hello world'])}${body.dimensions > 0 ? ',' : ''}`,
      ...(body.dimensions > 0 ? [`    dimensions=${body.dimensions},`] : []),
      ')',
      'print(len(resp.data), len(resp.data[0].embedding))',
    ].join('\n')
  return {
    curl: [
      `curl -X POST '${url}' \\`,
      `  -H 'Authorization: Bearer ${key}' \\`,
      '  -H \'Content-Type: application/json\' \\',
      `  -d '${JSON.stringify(body)}'`,
    ].join('\n'),
    python,
    node: [
      `const res = await fetch('${url}', {`,
      '  method: \'POST\',',
      `  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ${key}' },`,
      `  body: JSON.stringify(${jsonText(body).replace(/\n/g, '\n  ')}),`,
      '})',
      'console.log(await res.json())',
    ].join('\n'),
  }
}
