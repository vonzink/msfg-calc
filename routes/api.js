'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const https = require('https');

const siteConfigPath = path.join(__dirname, '..', 'config', 'site.json');
const promptsDir = path.join(__dirname, '..', 'config', 'ai-prompts');

function readSiteConfig() {
  try {
    return JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function readPrompts() {
  try {
    var result = {};
    fs.readdirSync(promptsDir).forEach(function(file) {
      if (path.extname(file) !== '.json') return;
      var slug = path.basename(file, '.json');
      result[slug] = JSON.parse(fs.readFileSync(path.join(promptsDir, file), 'utf-8'));
    });
    return result;
  } catch (err) {
    return null;
  }
}

// Memory-only storage — no files written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

/**
 * Convert a PDF buffer to an array of PNG image buffers (one per page).
 * Uses pdf-to-img (ESM) with dynamic import. Scale 2.0 ≈ 144 DPI.
 */
async function pdfToImages(pdfBuffer, maxPages) {
  const { pdf } = await import('pdf-to-img');
  const images = [];
  for await (const page of await pdf(pdfBuffer, { scale: 2.0 })) {
    images.push(page);
    if (images.length >= maxPages) break;
  }
  return images;
}

/**
 * POST /api/ai/extract
 * Body: multipart form with `file` (image/PDF) and `slug` (string)
 * Returns: { success, data } or { success: false, message }
 */
router.post('/ai/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded or unsupported file type.' });
    }

    const slug = (req.body.slug || '').trim();
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Missing calculator slug.' });
    }

    // Read AI config
    const siteConfig = readSiteConfig();
    if (!siteConfig || !siteConfig.ai || !siteConfig.ai.apiKey) {
      return res.status(400).json({ success: false, message: 'No AI API key configured. Go to Settings to add one.' });
    }

    const provider = siteConfig.ai.provider;
    if (provider !== 'openai') {
      return res.status(400).json({ success: false, message: 'AI extraction currently requires OpenAI. Set provider to "openai" in Settings.' });
    }

    // Read prompt config
    const prompts = readPrompts();
    if (!prompts || !prompts[slug]) {
      return res.status(400).json({ success: false, message: `No AI prompt configured for calculator "${slug}".` });
    }

    const promptConfig = prompts[slug];
    const model = promptConfig.model || 'gpt-4o';
    const systemPrompt = promptConfig.prompt;

    const mimeType = req.file.mimetype;
    const isPdf = mimeType === 'application/pdf';

    // Build image content blocks — PDFs are rendered to PNG first for accuracy
    let imageBlocks;
    if (isPdf) {
      const pageImages = await pdfToImages(req.file.buffer, 5);
      imageBlocks = pageImages.map(imgBuf => ({
        type: 'input_image',
        image_url: `data:image/png;base64,${imgBuf.toString('base64')}`
      }));
    } else {
      const base64 = req.file.buffer.toString('base64');
      imageBlocks = [{
        type: 'input_image',
        image_url: `data:${mimeType};base64,${base64}`
      }];
    }

    // Add text instruction after images
    const contentBlocks = [
      ...imageBlocks,
      { type: 'input_text', text: 'Extract the data from this document. Return only valid JSON.' }
    ];

    // Use OpenAI Responses API — all inputs sent as images for consistent accuracy
    const requestBody = JSON.stringify({
      model: model,
      instructions: systemPrompt,
      input: [
        { role: 'user', content: contentBlocks }
      ],
      text: { format: { type: 'json_object' } }
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/responses',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + siteConfig.ai.apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          if (apiRes.statusCode !== 200) {
            const errMsg = parsed.error?.message || ('OpenAI API error: HTTP ' + apiRes.statusCode);
            return res.status(502).json({ success: false, message: errMsg });
          }

          // Responses API returns output[].content[].text
          const textBlock = parsed.output?.find(o => o.type === 'message')
            ?.content?.find(c => c.type === 'output_text');
          const content = textBlock?.text;
          if (!content) {
            return res.status(502).json({ success: false, message: 'No content in AI response.' });
          }

          const extracted = JSON.parse(content);
          res.json({ success: true, data: extracted });
        } catch (err) {
          res.status(502).json({ success: false, message: 'Failed to parse AI response: ' + err.message });
        }
      });
    });

    apiReq.on('error', (err) => {
      res.status(502).json({ success: false, message: 'Connection error: ' + err.message });
    });

    apiReq.write(requestBody);
    apiReq.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
