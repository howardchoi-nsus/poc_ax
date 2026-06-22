const fs = require('fs');
const path = require('path');

const sourcePath =
  process.argv[2] ||
  'C:/Users/HowardChoi/Downloads/AGENT1_PRD생성_Vercel_poc.json';
const outputPath =
  process.argv[3] ||
  path.resolve(__dirname, '../docs/AGENT1_PRD생성_Vercel_poc_requestid_errorlog.json');

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const byName = (name) => workflow.nodes.find((node) => node.name === name);

const normalize = byName('Normalize - PRD Generate');
if (!normalize.parameters.jsCode.includes('const requestId = pick(')) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "const requirementSetId = pick(\n  payload.requirementSetId,\n  `REQ_SET_${ts}`\n);",
    "const requirementSetId = pick(\n  payload.requirementSetId,\n  `REQ_SET_${ts}`\n);\n\nconst requestId = pick(\n  payload.requestId,\n  requirementSetId\n);"
  );
}
if (!normalize.parameters.jsCode.includes('      requestId,\n      requirementSetId,')) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    '      requirementSetId,\n      requirementFilePaths: normalizedPaths,',
    '      requestId,\n      requirementSetId,\n      requirementFilePaths: normalizedPaths,'
  );
}
if (!normalize.parameters.jsCode.includes('estimatedSeconds: Number(payload.estimatedSeconds')) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    '      receivedAt: new Date().toISOString()',
    '      estimatedSeconds: Number(payload.estimatedSeconds || 0) || null,\n      receivedAt: new Date().toISOString()'
  );
}

const preprocess = byName('Pre-process Selected Requirements');
preprocess.parameters.jsCode = preprocess.parameters.jsCode
  .replace(
    "const outputDir = (input.githubOutputDir || 'prd').replace",
    "const outputDir = (input.outputDir || input.githubOutputDir || 'prd').replace"
  )
  .replace(
    "const mapDir = (input.githubMapDir || 'maps').replace",
    "const mapDir = (input.mapDir || input.githubMapDir || 'maps').replace"
  )
  .replace(
    "const logDir = (input.githubLogDir || 'logs').replace",
    "const logDir = (input.logDir || input.githubLogDir || 'logs').replace"
  );
if (!preprocess.parameters.jsCode.includes('promptCharCount: normalizeText(input.promptText).length,')) {
  preprocess.parameters.jsCode = preprocess.parameters.jsCode.replace(
    'requirementCount: input.requirementDocs.length,',
    [
      'requirementCount: input.requirementDocs.length,',
      '    promptCharCount: normalizeText(input.promptText).length,',
      '    requirementCharCount: mergedRequirements.length,',
      '    llmInputCharCount: llmInput.length,'
    ].join('\n')
  );
}

const prepareResult = byName('Prepare Result Files');
if (!prepareResult.parameters.jsCode.includes('const mapping = {\n  requestId: input.requestId,')) {
  prepareResult.parameters.jsCode = prepareResult.parameters.jsCode.replace(
    'const mapping = {\n  requirementSetId: input.requirementSetId,',
    'const mapping = {\n  requestId: input.requestId,\n  requirementSetId: input.requirementSetId,'
  );
}
if (!prepareResult.parameters.jsCode.includes('const log = {\n  requestId: input.requestId,')) {
  prepareResult.parameters.jsCode = prepareResult.parameters.jsCode.replace(
    'const log = {\n  executionId:',
    'const log = {\n  requestId: input.requestId,\n  executionId:'
  );
}
if (!prepareResult.parameters.jsCode.includes('    requestId: input.requestId,\n    requirementSetId: input.requirementSetId,')) {
  prepareResult.parameters.jsCode = prepareResult.parameters.jsCode.replace(
    '    requirementSetId: input.requirementSetId,',
    '    requestId: input.requestId,\n    requirementSetId: input.requirementSetId,'
  );
}

const prepareResponse = byName('Prepare Response - PRD Generate');
if (!prepareResponse.parameters.jsCode.includes('requestId: input.requestId,\n  requirementSetId: input.requirementSetId,')) {
  prepareResponse.parameters.jsCode = prepareResponse.parameters.jsCode.replace(
    'requirementSetId: input.requirementSetId,',
    'requestId: input.requestId,\n  requirementSetId: input.requirementSetId,'
  );
}

const savePrd = byName('Save PRD to Blob');
for (const param of savePrd.parameters.headerParameters.parameters) {
  if (param.name === 'content-Typr') param.name = 'Content-Type';
}

const generate = byName('Generate PRD');
generate.onError = 'continueErrorOutput';
generate.parameters.responses = {
  values: [
    {
      role: 'user',
      content: "={{ $('Pre-process Selected Requirements').item.json.llmInput }}"
    }
  ]
};

const prepareError = {
  parameters: {
    jsCode: `const input = $('Pre-process Selected Requirements').item.json;
const errorPayload = $json || {};
const error = errorPayload.error || errorPayload;
const message = error.message || error.description || errorPayload.message || 'n8n workflow error';
const logDir = String(input.logDir || 'logs').replace(/^\\/+|\\/+$/g, '');
const id = input.requestId || input.requirementSetId || input.timestamp;
const errorFilePath = \`\${logDir}/ERR_\${id}_\${input.timestamp}.json\`;
const response = {
  success: false,
  status: 'error',
  step: 'Generate PRD',
  nodeName: 'Generate PRD',
  message,
  requestId: input.requestId,
  requirementSetId: input.requirementSetId,
  requirementFilePaths: input.requirementFilePaths,
  promptFilePath: input.promptFilePath,
  errorFilePath,
  createdAt: new Date().toISOString()
};
return [{ json: {
  ...input,
  status: 'error',
  errorFilePath,
  errorText: JSON.stringify(response, null, 2),
  response
}}];`
  },
  id: 'prepare-prd-error-log',
  name: 'Prepare PRD Error Log',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2500, 520]
};

const saveError = {
  parameters: {
    method: 'POST',
    url: '=https://howardchoi-nsus-pocax.vercel.app/api/blob-save',
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'Content-Type', value: 'application/json' }]
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: 'path', value: '={{ $json.errorFilePath }}' },
        { name: 'content', value: '={{ $json.errorText }}' },
        { name: 'contentType', value: 'application/json; charset=utf-8' },
        { name: 'access', value: 'private' }
      ]
    },
    options: {}
  },
  id: 'save-prd-error-log-to-blob',
  name: 'Save PRD Error Log to Blob',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2720, 520]
};

const respondError = {
  parameters: {
    respondWith: 'json',
    responseBody: "={{ $('Prepare PRD Error Log').item.json.response }}",
    options: { responseCode: 500 }
  },
  id: 'respond-prd-generate-error',
  name: 'Respond - PRD Generate Error',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [2940, 520]
};

for (const node of [prepareError, saveError, respondError]) {
  if (!byName(node.name)) workflow.nodes.push(node);
}

workflow.connections['Generate PRD'].main[1] = [
  { node: 'Prepare PRD Error Log', type: 'main', index: 0 }
];
workflow.connections['Prepare PRD Error Log'] = {
  main: [[{ node: 'Save PRD Error Log to Blob', type: 'main', index: 0 }]]
};
workflow.connections['Save PRD Error Log to Blob'] = {
  main: [[{ node: 'Respond - PRD Generate Error', type: 'main', index: 0 }]]
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log(outputPath);
