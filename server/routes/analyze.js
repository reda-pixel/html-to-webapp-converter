const express = require('express');
const router = express.Router();

/**
 * POST /api/analyze
 * Analyzes HTML content and returns structured data
 * 
 * Request body:
 * {
 *   html: string (required) - HTML content to analyze
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     structure: object - Document structure
 *     elements: array - List of elements
 *     styles: object - Extracted styles
 *     scripts: array - Script tags and their content
 *     meta: object - Meta information
 *   },
 *   error: string (optional)
 * }
 */
router.post('/', (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }

    // Parse and analyze HTML
    const analysis = analyzeHTML(html);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Analyzes HTML content and extracts useful information
 * @param {string} html - HTML content
 * @returns {object} Analysis results
 */
function analyzeHTML(html) {
  const analysis = {
    structure: {},
    elements: [],
    styles: {},
    scripts: [],
    meta: {}
  };

  // Extract meta information
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) {
    analysis.meta.title = titleMatch[1];
  }

  const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (descriptionMatch) {
    analysis.meta.description = descriptionMatch[1];
  }

  // Extract all meta tags
  const metaTags = html.match(/<meta[^>]*>/gi) || [];
  analysis.meta.tags = metaTags;

  // Extract style tags
  const styleTags = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  analysis.styles.inline = styleTags;

  // Extract external stylesheets
  const linkTags = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];
  analysis.styles.external = linkTags;

  // Extract script tags
  const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  analysis.scripts = scriptTags.map((tag, index) => ({
    id: index,
    tag: tag,
    external: /src=["']([^"']+)["']/.test(tag)
  }));

  // Extract all HTML elements
  const elementRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
  let match;
  const elementCounts = {};

  while ((match = elementRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
  }

  analysis.elements = Object.entries(elementCounts).map(([tag, count]) => ({
    tag,
    count
  }));

  // Extract document structure
  analysis.structure = {
    hasHead: /<head[^>]*>/i.test(html),
    hasBody: /<body[^>]*>/i.test(html),
    hasDoctype: /<!doctype/i.test(html),
    htmlLang: (html.match(/<html[^>]*lang=["']?([^"'\s>]+)/i) || [null, null])[1]
  };

  return analysis;
}

module.exports = router;
