const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { run, get, all } = require('./db');
const { callGemini } = require('./aiModelHelper');
const { generateDiagramSvg } = require('./visualizationEngine');

const SNAPSHOT_DIR = path.join(__dirname, '..', 'data', 'snapshots');
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

/**
 * Detects and crops individual educational diagrams from screenshot using sharp
 */
async function extractAndCropDiagrams({ imagePath, base64Buffer, diagrams = [], prefix = 'diag' }) {
  if (!imagePath && !base64Buffer) return [];
  const results = [];

  try {
    const input = imagePath || base64Buffer;
    const metadata = await sharp(input).metadata();
    const width = metadata.width || 1280;
    const height = metadata.height || 720;

    for (let i = 0; i < diagrams.length; i++) {
      const d = diagrams[i];
      if (!d) continue;
      const diagId = `${prefix}_diag_${i + 1}`;
      const filename = `${diagId}.jpg`;
      const outPath = path.join(SNAPSHOT_DIR, filename);

      const box = d.box_2d || d.boundingBox;
      if (Array.isArray(box) && box.length === 4) {
        let [ymin, xmin, ymax, xmax] = box;
        if (ymax > 1 && ymax <= 1000) {
          ymin = ymin / 1000;
          xmin = xmin / 1000;
          ymax = ymax / 1000;
          xmax = xmax / 1000;
        }
        // Pad 8% around diagram to avoid cropping labels
        const padY = Math.max(0.04, (ymax - ymin) * 0.08);
        const padX = Math.max(0.04, (xmax - xmin) * 0.08);
        const top = Math.max(0, Math.floor((ymin - padY) * height));
        const left = Math.max(0, Math.floor((xmin - padX) * width));
        const cropH = Math.min(height - top, Math.ceil((ymax - ymin + 2 * padY) * height));
        const cropW = Math.min(width - left, Math.ceil((xmax - xmin + 2 * padX) * width));

        if (cropW > 40 && cropH > 40) {
          await sharp(input)
            .extract({ left, top, width: cropW, height: cropH })
            .jpeg({ quality: 90 })
            .toFile(outPath);

          results.push({
            id: diagId,
            title: d.title || `Original Diagram ${i + 1}`,
            description: d.description || '',
            imagePath: outPath,
            labels: d.labels || [],
            subject: d.subject || 'general',
            isSourceDiagram: true,
          });
          continue;
        }
      }

      // If no box or box invalid, preserve full source image reference
      results.push({
        id: diagId,
        title: d.title || `Original Diagram ${i + 1}`,
        description: d.description || '',
        imagePath: imagePath,
        labels: d.labels || [],
        subject: d.subject || 'general',
        isSourceDiagram: true,
      });
    }
  } catch (err) {
    console.warn('[Vision] Diagram cropping warning:', err.message);
  }

  return results;
}

/* ─── Bounded LRU Cache to avoid memory leaks during long lectures ──────────── */
class BoundedLruCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
  has(key) {
    return this.cache.has(key);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
}

const visionAnalysisCache = new BoundedLruCache(500);

/**
 * Objective quality score for an educational snapshot
 */
function calculateSnapshotQualityScore(snap = {}) {
  let score = 0;

  // 1. Equations & Mathematical Content
  const eqs = Array.isArray(snap.equations) ? snap.equations : [];
  score += eqs.length * 20;
  const eqStr = snap.equation || (Array.isArray(snap.equations) ? snap.equations.map(e => e.latex || e).join(' ') : '');
  if (eqStr && typeof eqStr === 'string' && eqStr.trim()) {
    score += 15;
    if (/[=+\-*/\\^_{}]/.test(eqStr)) score += 10;
  }

  // 2. Structured items & Rendered Visualizations
  const items = Array.isArray(snap.extractedContent) ? snap.extractedContent : [];
  score += items.length * 15;
  for (const item of items) {
    if (item.visualizationRequired && item.svg) score += 25;
    if (item.variables && typeof item.variables === 'object') {
      score += Object.keys(item.variables).length * 5;
    }
    if (item.explanation && item.explanation.length > 20) score += 10;
  }

  // 3. Extracted Text completeness
  const text = (snap.extracted_text || snap.extractedText || '').trim();
  score += Math.min(Math.floor(text.length / 5), 35);

  // 4. Slide Title & Topic specificity
  const topic = (snap.main_concept || snap.mainConcept || snap.slide_title || snap.slideTitle || snap.topic || '').trim();
  if (topic && !topic.toLowerCase().includes('captured at') && !topic.toLowerCase().includes('content')) {
    score += 15;
  }

  // 5. Existing Diagrams & Key Points
  const diagDesc = (snap.diagram_description || snap.diagramDescription || '').trim();
  if (diagDesc && diagDesc.length > 10) score += 15;
  if (snap.diagram && typeof snap.diagram === 'object' && Object.keys(snap.diagram).length > 0) {
    score += 15;
  }
  const kps = Array.isArray(snap.keyPoints) ? snap.keyPoints : (Array.isArray(snap.key_points) ? snap.key_points : []);
  score += kps.length * 6;

  return score;
}

/**
 * Checks whether an incoming snapshot represents the exact same slide or formula
 * captured again (e.g. camera focus adjustment or identical re-capture)
 * VS a genuinely distinct instructional state / progression that must be preserved.
 */
function isDuplicateOrSameTopic(existing, incoming) {
  if (!existing || !incoming) return false;

  // 1. Exact cryptographic image hash match -> definitive duplicate
  if (existing.image_hash && incoming.imageHash && existing.image_hash === incoming.imageHash) {
    return true;
  }

  // Helper to extract clean formula strings
  const getFormulas = (snap) => {
    const list = [];
    if (snap.equation) list.push(snap.equation);
    if (Array.isArray(snap.equations)) {
      snap.equations.forEach((e) => list.push(typeof e === 'string' ? e : e.latex || ''));
    }
    const items = Array.isArray(snap.extractedContent)
      ? snap.extractedContent
      : (() => { try { return JSON.parse(snap.structured_content_json || '[]'); } catch (_) { return []; } })();
    items.forEach((it) => {
      if (it.type === 'formula' && it.content) list.push(it.content);
    });
    return list.map((f) => f.replace(/[\s\$\\]/g, '').toLowerCase()).filter((f) => f.length > 2);
  };

  const formsA = getFormulas(existing);
  const formsB = getFormulas(incoming);

  // If BOTH have formulas:
  if (formsA.length > 0 && formsB.length > 0) {
    let formulaMatched = false;
    for (const fA of formsA) {
      for (const fB of formsB) {
        if (fA === fB || fA.includes(fB) || fB.includes(fA)) {
          formulaMatched = true;
          break;
        }
      }
      if (formulaMatched) break;
    }

    if (formulaMatched) {
      // Both have the same core formula -> duplicate re-capture
      return true;
    }

    // Both have formulas, but NONE match (e.g. v=u+at vs s=ut+0.5at^2)
    // Distinct instructional equations -> preserve both!
    return false;
  }

  // 2. High text overlap (Jaccard similarity on significant words)
  const textA = (existing.extracted_text || existing.extractedText || '').toLowerCase();
  const textB = (incoming.extractedText || '').toLowerCase();
  const wordsA = new Set(textA.split(/\W+/).filter((w) => w.length > 3));
  const wordsB = new Set(textB.split(/\W+/).filter((w) => w.length > 3));
  if (wordsA.size >= 4 && wordsB.size >= 4) {
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard >= 0.75) {
      return true;
    }
  }

  return false;
}

/* ─── JSON helpers ──────────────────────────────────────────────────────────── */
function parseJsonSafe(rawText) {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```$/m, '').trim();
    return JSON.parse(cleaned);
  } catch (_) {
    const m = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch (__) {} }
    return null;
  }
}

/* ─── Resolve lectureId → DB primary key ───────────────────────────────────── */
async function resolveLectureId(lectureId) {
  let lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  if (!lec) {
    const defaultHost = await get('SELECT id FROM users LIMIT 1');
    const hostId = defaultHost?.id || 'usr_teacher_demo';
    const fallbackId = 'lec_' + uuidv4().slice(0, 8);
    await run(
      `INSERT OR IGNORE INTO lectures (id, room_id, title, description, host_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fallbackId, lectureId, 'Live Lecture Session', 'Auto-created lecture room', hostId, 'LIVE']
    );
    lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ?', [fallbackId, lectureId]);
  }
  return lec ? lec.id : lectureId;
}

/* ════════════════════════════════════════════════════════════════════════════
   PROMPT: Comprehensive Concept Understanding & Visual Specification
════════════════════════════════════════════════════════════════════════════ */
const CONCEPT_VISION_PROMPT = `You are an expert senior AI vision and pedagogical engineer analyzing a lecture screenshot (whiteboard, handwritten notes, presentation slide, or camera view).

Analyze the visual content thoroughly:
1. Extract all text, formulas, symbols, and headings accurately.
2. Understand the underlying scientific/technical concept represented (mathematics, biology, computer science, physics).
3. Detect whether one or more original educational diagrams already exist in the image (e.g. human excretory system, kidney longitudinal section, circle with radius, circuits, flowcharts).
4. For each educational diagram present in the image, provide its title, description, detected labels, and precise normalized bounding box [ymin, xmin, ymax, xmax] (values from 0 to 1000) so it can be cropped and preserved in study notes.
5. If a diagram is absent but needed to explain an equation/concept, provide parameters for deterministic SVG rendering (geometry_diagram, biological_system, coordinate_graph, algorithm_steps, block_diagram).

Return ONLY a strict raw JSON object (no markdown code blocks, no conversational text):
{
  "topic": "Main technical topic (e.g. 'Human Physiology: Excretory Products and Their Elimination', 'Circle Geometry: Area Formula', 'Kinematics: Velocity Equation', 'Binary Search')",
  "subject": "biology | mathematics | computer_science | physics | general",
  "extractedText": "All legible plain text, preserving structure",
  "diagramsPresent": [
    {
      "title": "Diagram title (e.g. 'Human Urinary System' or 'Longitudinal section of kidney' or 'Circle with radius r')",
      "description": "Clear description of what the illustration shows",
      "box_2d": [100, 200, 800, 900],
      "labels": ["Kidney", "Ureter", "Urinary bladder", "Urethra", "Renal artery", "Renal vein"],
      "subject": "biology"
    }
  ],
  "extractedContent": [
    {
      "type": "formula | algorithm | concept | diagram | code",
      "content": "The exact formula (e.g. 'Area = \\pi r^2', 'v = u + at'), anatomical concept, or code",
      "explanation": "Clear, student-friendly explanation of what this means physically or conceptually",
      "variables": {
        "symbol_1": "Meaning and unit, e.g. 'Radius r (distance from center)'",
        "symbol_2": "Meaning and unit, e.g. 'Enclosed area (units²)'"
      },
      "visualizationRequired": true,
      "visualizationType": "preserved_source_diagram | geometry_diagram | biological_system | coordinate_graph | algorithm_steps | flowchart | block_diagram",
      "visualizationDescription": "Description of the visual explanation and why it aids comprehension",
      "visualizationSpec": {
        "shape": "circle",
        "radius": "r",
        "formula": "A = \\pi r^2",
        "radiusLabel": "r",
        "stages": [
          { "name": "Kidneys", "role": "Filtration & Urine Formation" },
          { "name": "Ureters", "role": "Urine Transport" },
          { "name": "Urinary Bladder", "role": "Storage" },
          { "name": "Urethra", "role": "Elimination" }
        ],
        "fn": "3 + 2*x",
        "xAxisLabel": "Time t (s)",
        "yAxisLabel": "Velocity v (m/s)"
      },
      "takeaway": "Key educational takeaway or rule of thumb for student revision"
    }
  ],
  "existingDiagram": {
    "present": false,
    "type": "anatomy | geometry | flowchart | graph | circuit | table | none",
    "title": "Diagram title if visible",
    "description": "Description of what is drawn on the board",
    "steps": ["Step 1", "Step 2"]
  },
  "equations": [
    {
      "name": "Formula Name",
      "latex": "valid LaTeX e.g. $Area = \\pi r^2$ or $v = u + at$",
      "description": "Brief description"
    }
  ],
  "keyPoints": [
    "Key takeaway point 1",
    "Key takeaway point 2"
  ]
}

Rules:
- For geometry (circle, radius r, Area = πr²), specify visualizationType: "geometry_diagram", never a flowchart!
- For biology / anatomy (excretory system, kidney, organs), preserve the source diagram or specify visualizationType: "biological_system", never a software flowchart!
- For kinematics / calculus equations, specify visualizationType: "coordinate_graph".
- For search/sort algorithms, specify visualizationType: "algorithm_steps".`;

/* ─── Enrich Content Items With Deterministic SVGs ──────────────────────────── */
function enrichItemsWithSvgs(extractedContent = []) {
  if (!Array.isArray(extractedContent)) return [];

  return extractedContent.map((item) => {
    if (!item) return item;
    
    // If visualization is required, generate deterministic SVG
    if (item.visualizationRequired && item.visualizationSpec) {
      try {
        const svg = generateDiagramSvg({
          visualizationType: item.visualizationType,
          ...item.visualizationSpec,
        });
        return { ...item, svg };
      } catch (err) {
        console.warn('[VisualizationEngine] Failed to render SVG for item:', err.message);
        return { ...item, svg: null };
      }
    }
    return item;
  });
}

/* ─── Fallback Heuristic Generator for Formulas & Concepts Without LLM ─────── */
function generateHeuristicConcept(text = '', equations = []) {
  const eqStr = equations.map((e) => e.latex || e.name).join(' ');
  const combined = (text + ' ' + eqStr).toLowerCase();

  // 1. Circle Geometry (Example B: Circle with radius r, Area = \pi r^2)
  if (combined.includes('circle') || combined.includes('area = \pi r^2') || combined.includes('pi r^2') || combined.includes('pir^2') || combined.includes('pi r²') || (combined.includes('area') && combined.includes('radius'))) {
    const spec = {
      title: 'Circle Geometry: Radius and Enclosed Area',
      shape: 'circle',
      radius: 'r',
      formula: 'A = \\pi r^2',
      radiusLabel: 'r',
    };
    return {
      topic: 'Circle Geometry: Radius and Area Formula',
      extractedContent: [
        {
          type: 'formula',
          content: 'Area = \\pi r^2',
          subject: 'geometry',
          explanation: 'The area of a circle is directly proportional to the square of its radius, multiplied by the mathematical constant pi (π ≈ 3.14159).',
          variables: {
            r: 'Radius of the circle (distance from center O to any perimeter point)',
            A: 'Area enclosed by the circular boundary (units²)',
            '\\pi': 'Mathematical constant ratio of circumference to diameter (≈ 3.14159)',
          },
          visualizationRequired: true,
          visualizationType: 'geometry_diagram',
          visualizationDescription: 'Geometric circle showing center O, radius line labeled r, and quadratic area scaling law.',
          visualizationSpec: spec,
          svg: generateDiagramSvg(spec),
          takeaway: 'Doubling the radius quadruples the area because the radius is squared in the area formula (A ∝ r²).',
        },
      ],
    };
  }

  // 2. Human Physiology / Excretory Products & Kidney Anatomy (Example A: Biology)
  if (combined.includes('excret') || combined.includes('kidney') || combined.includes('urinary') || combined.includes('nephron') || combined.includes('homeostasis') || combined.includes('ammonotelism') || combined.includes('ureotelism') || combined.includes('uricotelism') || combined.includes('pelvis') || combined.includes('ureter')) {
    const excretorySpec = {
      title: 'Human Excretory System: Organ Pathway',
      stages: [
        { name: 'Kidneys', role: 'Filtration & Urine Formation (~1M Nephrons)', color: '#065f46' },
        { name: 'Ureters', role: 'Peristaltic Urine Transport', color: '#1e3a8a' },
        { name: 'Urinary Bladder', role: 'Temporary Distensible Storage', color: '#78350f' },
        { name: 'Urethra', role: 'Micturition & Body Exit', color: '#831843' },
      ],
    };
    const kidneyZonationSpec = {
      title: 'Longitudinal Section of Kidney: Internal Zonation',
      stages: [
        { name: 'Renal Cortex', role: 'Outer Zone with Malpighian Corpuscles', color: '#0f766e' },
        { name: 'Renal Medulla', role: 'Medullary Pyramids & Loops of Henle', color: '#4338ca' },
        { name: 'Renal Pelvis & Calyces', role: 'Funnel Collecting Urine from Papillae', color: '#b45309' },
        { name: 'Ureter', role: 'Exits Kidney Hilum towards Bladder', color: '#be123c' },
      ],
    };

    return {
      topic: 'Human Physiology: Excretory Products and Their Elimination',
      extractedContent: [
        {
          type: 'concept',
          content: 'Human Excretory System: Excretion and Homeostasis',
          subject: 'biology',
          explanation: 'Excretion is the biological process of expelling non-gaseous nitrogenous metabolic wastes (ammonia, urea, uric acid) and excess substances out of the body to maintain constant internal chemical homeostasis.',
          variables: {
            Homeostasis: 'Maintenance of constant internal chemical composition and osmotic pressure',
            Ammonotelism: 'Excretion of highly toxic ammonia; requires large water volume (e.g. aquatic bony fishes)',
            Ureotelism: 'Excretion of moderately toxic urea; requires moderate water (e.g. mammals, terrestrial amphibians)',
            Uricotelism: 'Excretion of least toxic uric acid as paste; minimal water loss (e.g. birds, reptiles)',
          },
          visualizationRequired: true,
          visualizationType: 'biological_system',
          visualizationDescription: 'Sequential anatomical pathway of the human urinary system from kidney filtration to urethral elimination.',
          visualizationSpec: excretorySpec,
          svg: generateDiagramSvg(excretorySpec),
          takeaway: 'The primary purpose of the excretory system is osmoregulation and maintaining homeostasis by removing toxic nitrogenous wastes.',
        },
        {
          type: 'concept',
          content: 'Anatomy of the Human Kidney and Nephron',
          explanation: 'Kidneys are reddish-brown, bean-shaped structures situated between the last thoracic and third lumbar vertebra. Each adult kidney measures 10-12 cm in length, 5-7 cm in width, 2-3 cm in thickness, and weighs 120-170 g. The inner concave surface features a notch called the hilum, leading to a broad funnel-shaped renal pelvis.',
          variables: {
            'Length (L)': '10-12 cm in adult humans',
            'Width (W)': '5-7 cm across concave-to-convex axis',
            'Thickness (T)': '2-3 cm anterior-posterior depth',
            'Mass': 'Average weight 120-170 grams',
            'Nephron Count': '~1,000,000 functional filtering units per kidney',
          },
          visualizationRequired: true,
          visualizationType: 'biological_system',
          visualizationDescription: 'Internal zonation of the kidney showing the renal cortex, medullary pyramids, calyces, and renal pelvis.',
          visualizationSpec: kidneyZonationSpec,
          svg: generateDiagramSvg(kidneyZonationSpec),
          takeaway: 'The nephron is the structural and functional unit of the human kidney (~1 million per kidney); the renal cortex extends between medullary pyramids as the Columns of Bertini.',
        },
      ],
    };
  }

  // 3. Kinematics (v = u + at)
  if (combined.includes('v = u + at') || combined.includes('u + at') || (combined.includes('velocity') && combined.includes('acceleration'))) {
    const spec = {
      title: 'Velocity vs. Time (v = u + at)',
      equation: 'v = u + at',
      fn: '3 + 2*x',
      xDomain: [0, 8],
      yDomain: [0, 20],
      xAxisLabel: 'Time t (s)',
      yAxisLabel: 'Velocity v (m/s)',
      points: [{ x: 0, y: 3, label: 'Initial Velocity u = 3 m/s', color: '#38bdf8' }],
      slopeTriangle: { x1: 2, x2: 6, label: 'Acceleration a = Δv/Δt = 2 m/s²' },
    };
    return {
      topic: 'Kinematics: Uniform Acceleration',
      extractedContent: [
        {
          type: 'formula',
          content: 'v = u + at',
          explanation: 'Calculates the final velocity of an object under constant acceleration over time.',
          variables: {
            v: 'Final velocity (m/s)',
            u: 'Initial velocity (m/s)',
            a: 'Constant acceleration (m/s²)',
            t: 'Time elapsed (s)',
          },
          visualizationRequired: true,
          visualizationType: 'coordinate_graph',
          visualizationDescription: 'Plot of velocity v against time t. The slope represents acceleration a, and the y-intercept is initial velocity u.',
          visualizationSpec: spec,
          svg: generateDiagramSvg(spec),
          takeaway: 'Velocity increases linearly with time when acceleration is constant.',
        },
      ],
    };
  }

  // 4. Linear Equation (y = mx + c)
  if (combined.includes('y = mx + c') || combined.includes('mx + c') || combined.includes('slope') || combined.includes('intercept')) {
    const spec = {
      title: 'Linear Plot (y = mx + c)',
      equation: 'y = 2x + 1',
      fn: '2*x + 1',
      xDomain: [-4, 6],
      yDomain: [-5, 12],
      xAxisLabel: 'x',
      yAxisLabel: 'y',
      points: [{ x: 0, y: 1, label: 'y-intercept c = (0, 1)', color: '#38bdf8' }],
      slopeTriangle: { x1: 1, x2: 3, label: 'Slope m = Δy/Δx = 2' },
    };
    return {
      topic: 'Linear Equations & Coordinate Geometry',
      extractedContent: [
        {
          type: 'formula',
          content: 'y = mx + c',
          explanation: 'Standard slope-intercept form of a linear equation representing a straight line on the Cartesian plane.',
          variables: {
            y: 'Dependent variable',
            m: 'Slope (gradient of the line)',
            x: 'Independent variable',
            c: 'Y-intercept (point where line crosses y-axis)',
          },
          visualizationRequired: true,
          visualizationType: 'coordinate_graph',
          visualizationDescription: 'Graph showing slope m controlling steepness and c shifting the line vertically.',
          visualizationSpec: spec,
          svg: generateDiagramSvg(spec),
          takeaway: 'Positive slope goes up from left to right; the intercept fixes the line position on the y-axis.',
        },
      ],
    };
  }

  // 5. Binary Search
  if (combined.includes('binary search') || combined.includes('binary_search') || (combined.includes('search') && combined.includes('array'))) {
    const spec = {
      title: 'Binary Search: Interval Reduction',
      array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
      target: 23,
      low: 4,
      mid: 5,
      high: 8,
      comparison: 'Target 23 == arr[5] 23 -> Target element found in O(log n)',
    };
    return {
      topic: 'Binary Search Algorithm',
      extractedContent: [
        {
          type: 'algorithm',
          content: 'Binary Search Algorithm (Interval Halving)',
          explanation: 'Efficient divide-and-conquer search on sorted arrays by repeatedly halving the search space.',
          variables: {
            low: 'Lower bound index',
            mid: 'Middle index: (low + high) / 2',
            high: 'Upper bound index',
            target: 'Value being searched',
          },
          visualizationRequired: true,
          visualizationType: 'algorithm_steps',
          visualizationDescription: 'Array interval shrinking diagram with low, mid, and high pointers.',
          visualizationSpec: spec,
          svg: generateDiagramSvg(spec),
          takeaway: 'Eliminates half of the remaining array elements at each comparison step (O(log n) time).',
        },
      ],
    };
  }

  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
   BOARD FRAME PROCESSOR
════════════════════════════════════════════════════════════════════════════ */
async function processBoardFrame({ lectureId, imageBase64, timestamp = 0, imagePath = null }) {
  const contentId = 'board_' + uuidv4().slice(0, 8);
  const resolvedLectureId = await resolveLectureId(lectureId);

  let extractedText = '';
  let equation = '';
  let equationsJson = '[]';
  let diagramDescription = '';
  let diagramJson = '{}';
  let keyPointsJson = '[]';
  let conceptDiagramJson = '{}';
  let mainConcept = '';
  let structuredContentJson = '[]';
  let extractedContent = [];
  let imageHash = '';

  if (imageBase64) {
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageHash = crypto.createHash('sha256').update(cleanBase64).digest('hex');
      const cacheKey = imageHash;

      // Persist full original image to disk
      if (!imagePath) {
        const snapFile = path.join(SNAPSHOT_DIR, `${contentId}_full.jpg`);
        try {
          fs.writeFileSync(snapFile, Buffer.from(cleanBase64, 'base64'));
          imagePath = snapFile;
        } catch (fErr) {
          console.warn('[Vision] Could not save board snapshot file:', fErr.message);
        }
      }

      let parsed = visionAnalysisCache.get(cacheKey);

      if (!parsed) {
        const visionResult = await callGemini(async (model) => {
          const resp = await model.generateContent([
            CONCEPT_VISION_PROMPT,
            { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          ]);
          return resp.response.text().trim();
        });

        parsed = parseJsonSafe(visionResult);
        if (parsed) {
          visionAnalysisCache.set(cacheKey, parsed);
        }
      }

      if (parsed) {
        extractedText = parsed.extractedText || '';
        mainConcept = parsed.topic || parsed.mainConcept || '';

        const eqs = Array.isArray(parsed.equations) ? parsed.equations : [];
        equationsJson = JSON.stringify(eqs);
        equation = eqs.map((e) => e.latex).filter(Boolean).join(' ; ');

        const diag = parsed.existingDiagram || parsed.diagram || {};
        diagramDescription = diag.description || (diag.steps ? 'Steps: ' + diag.steps.join(' → ') : '');
        diagramJson = JSON.stringify(diag);
        keyPointsJson = JSON.stringify(Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []);

        // Process structured items & generate deterministic SVGs
        extractedContent = enrichItemsWithSvgs(parsed.extractedContent || []);

        // Crop & preserve original educational diagrams if present
        const detectedDiagrams = Array.isArray(parsed.diagramsPresent)
          ? parsed.diagramsPresent
          : (parsed.diagram && typeof parsed.diagram === 'object' && Object.keys(parsed.diagram).length > 0 ? [parsed.diagram] : []);

        if (imagePath && detectedDiagrams.length > 0) {
          const preservedDiagrams = await extractAndCropDiagrams({
            imagePath,
            diagrams: detectedDiagrams,
            prefix: contentId,
          });

          if (preservedDiagrams.length > 0) {
            diag.preservedDiagrams = preservedDiagrams;
            diagramJson = JSON.stringify(diag);

            preservedDiagrams.forEach((pd) => {
              extractedContent.push({
                type: 'diagram',
                content: pd.title,
                explanation: pd.description || 'Preserved original lecture illustration.',
                variables: {},
                visualizationRequired: true,
                visualizationType: 'preserved_source_diagram',
                visualizationDescription: pd.description,
                visualizationSpec: {
                  title: pd.title,
                  caption: pd.description,
                  imagePath: pd.imagePath,
                  labels: pd.labels,
                  isSourceDiagram: true,
                },
                imagePath: pd.imagePath,
                isSourceDiagram: true,
                svg: generateDiagramSvg({
                  visualizationType: 'preserved_source_diagram',
                  title: pd.title,
                  caption: pd.description,
                  imagePath: pd.imagePath,
                  labels: pd.labels,
                }),
              });
            });
          }
        }

        structuredContentJson = JSON.stringify(extractedContent);

        // Fallback heuristic if extractedContent was empty but text contains known concepts
        if (extractedContent.length === 0) {
          const heuristic = generateHeuristicConcept(extractedText, eqs);
          if (heuristic) {
            extractedContent = heuristic.extractedContent;
            if (imagePath && extractedContent.length > 0) {
              extractedContent[0].imagePath = imagePath;
              if (extractedContent[0].visualizationSpec) {
                extractedContent[0].visualizationSpec.imagePath = imagePath;
              }
            }
            structuredContentJson = JSON.stringify(extractedContent);
            if (!mainConcept) mainConcept = heuristic.topic;
          }
        }
      } else {
        extractedText = `Board content captured at ${Math.round(timestamp)}s`;
      }
    } catch (err) {
      console.warn('[Vision Board] Vision AI error:', err.message);
      extractedText = `Whiteboard content captured at ${Math.round(timestamp)}s`;
    }
  } else {
    extractedText = `Whiteboard notes captured at ${Math.round(timestamp)}s`;
  }

  let equations = [], diagram = {}, keyPoints = [], conceptDiagram = {};
  try { equations = JSON.parse(equationsJson); } catch (_) {}
  try { diagram = JSON.parse(diagramJson); } catch (_) {}
  try { keyPoints = JSON.parse(keyPointsJson); } catch (_) {}
  try { conceptDiagram = JSON.parse(conceptDiagramJson); } catch (_) {}

  // ── Smart Deduplication & Quality Selection ──
  const currentSnapshot = {
    id: contentId,
    lectureId: resolvedLectureId,
    timestamp,
    imagePath,
    extractedText,
    equation,
    equations,
    diagramDescription,
    diagram,
    keyPoints,
    mainConcept,
    conceptDiagram,
    extractedContent,
    imageHash,
  };

  const newScore = calculateSnapshotQualityScore(currentSnapshot);
  currentSnapshot.qualityScore = newScore;

  // Check recent snapshots for deduplication
  let matchRow = null;
  try {
    const recentRows = await all(
      'SELECT * FROM board_contents WHERE lecture_id = ? ORDER BY timestamp DESC LIMIT 8',
      [resolvedLectureId]
    );
    for (const r of recentRows) {
      if (isDuplicateOrSameTopic(r, currentSnapshot)) {
        matchRow = r;
        break;
      }
    }
  } catch (err) {
    console.warn('[Deduplication] Query error:', err.message);
  }

  if (matchRow) {
    const existingScore = matchRow.quality_score || calculateSnapshotQualityScore(matchRow);
    if (newScore >= existingScore) {
      // New snapshot is superior or clearer -> update existing row!
      await run(
        `UPDATE board_contents SET
           timestamp = ?,
           image_path = COALESCE(?, image_path),
           extracted_text = ?,
           equation = ?,
           diagram_description = ?,
           equations_json = ?,
           diagram_json = ?,
           key_points_json = ?,
           concept_diagram_json = ?,
           main_concept = ?,
           structured_content_json = ?,
           image_hash = ?,
           quality_score = ?
         WHERE id = ?`,
        [timestamp, imagePath, extractedText, equation, diagramDescription,
         equationsJson, diagramJson, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson,
         imageHash, newScore, matchRow.id]
      ).catch(() => {});

      return {
        ...currentSnapshot,
        id: matchRow.id,
        isUpdate: true,
        replacedId: matchRow.id,
        qualityScore: newScore,
        message: 'Upgraded existing snapshot with higher clarity & formulas',
      };
    } else {
      // Existing snapshot is already better -> preserve existing, skip duplicate!
      let exEqs = [], exDiag = {}, exKps = [], exConc = {}, exExt = [];
      try { exEqs = JSON.parse(matchRow.equations_json || '[]'); } catch (_) {}
      try { exDiag = JSON.parse(matchRow.diagram_json || '{}'); } catch (_) {}
      try { exKps = JSON.parse(matchRow.key_points_json || '[]'); } catch (_) {}
      try { exConc = JSON.parse(matchRow.concept_diagram_json || '{}'); } catch (_) {}
      try { exExt = JSON.parse(matchRow.structured_content_json || '[]'); } catch (_) {}

      return {
        id: matchRow.id,
        lectureId: resolvedLectureId,
        timestamp: matchRow.timestamp,
        extractedText: matchRow.extracted_text,
        equation: matchRow.equation,
        equations: exEqs,
        diagramDescription: matchRow.diagram_description,
        diagram: exDiag,
        keyPoints: exKps,
        mainConcept: matchRow.main_concept,
        conceptDiagram: exConc,
        extractedContent: exExt,
        qualityScore: existingScore,
        isDuplicate: true,
        keptExistingId: matchRow.id,
        message: 'Preserved existing snapshot with higher educational clarity',
      };
    }
  }

  // Persist new unique snapshot
  await run(
    `INSERT INTO board_contents
     (id, lecture_id, timestamp, image_path, extracted_text, equation, diagram_description,
      equations_json, diagram_json, key_points_json, concept_diagram_json, main_concept, structured_content_json, image_hash, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contentId, resolvedLectureId, timestamp, imagePath,
     extractedText, equation, diagramDescription,
     equationsJson, diagramJson, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson, imageHash, newScore]
  ).catch(async () => {
    await run(
      `INSERT INTO board_contents
       (id, lecture_id, timestamp, image_path, extracted_text, equation, diagram_description,
        equations_json, diagram_json, key_points_json, concept_diagram_json, main_concept, structured_content_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [contentId, resolvedLectureId, timestamp, imagePath,
       extractedText, equation, diagramDescription,
       equationsJson, diagramJson, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson]
    );
  });

  // Record multimodal event
  await run(
    `INSERT INTO multimodal_events (id, lecture_id, timestamp, title, event_type, visual_content, combined_insight)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'evt_' + uuidv4().slice(0, 8), resolvedLectureId, timestamp,
      mainConcept || 'Board Note / Equation', 'BOARD',
      `${extractedText} ${equation ? `[Eq: ${equation}]` : ''}`.trim(),
      diagramDescription || 'Board visual content analyzed.',
    ]
  );

  return currentSnapshot;
}

/* ════════════════════════════════════════════════════════════════════════════
   SCREEN FRAME PROCESSOR
════════════════════════════════════════════════════════════════════════════ */
async function processScreenFrame({ lectureId, imageBase64, timestamp = 0, imagePath = null }) {
  const contentId = 'screen_' + uuidv4().slice(0, 8);
  const resolvedLectureId = await resolveLectureId(lectureId);

  let slideTitle = '';
  let extractedText = '';
  let codeSnippet = '';
  let diagramDescription = '';
  let equationsJson = '[]';
  let diagramJson = '{}';
  let codeLanguage = '';
  let keyPointsJson = '[]';
  let conceptDiagramJson = '{}';
  let mainConcept = '';
  let structuredContentJson = '[]';
  let extractedContent = [];
  let imageHash = '';

  if (imageBase64) {
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageHash = crypto.createHash('sha256').update(cleanBase64).digest('hex');
      const cacheKey = imageHash;

      // Persist full screen slide image to disk
      if (!imagePath) {
        const snapFile = path.join(SNAPSHOT_DIR, `${contentId}_full.jpg`);
        try {
          fs.writeFileSync(snapFile, Buffer.from(cleanBase64, 'base64'));
          imagePath = snapFile;
        } catch (fErr) {
          console.warn('[Vision] Could not save screen snapshot file:', fErr.message);
        }
      }

      let parsed = visionAnalysisCache.get(cacheKey);

      if (!parsed) {
        const visionResult = await callGemini(async (model) => {
          const resp = await model.generateContent([
            CONCEPT_VISION_PROMPT,
            { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          ]);
          return resp.response.text().trim();
        });

        parsed = parseJsonSafe(visionResult);
        if (parsed) {
          visionAnalysisCache.set(cacheKey, parsed);
        }
      }

      if (parsed) {
        slideTitle = parsed.topic || parsed.slideTitle || 'Presentation Slide';
        mainConcept = slideTitle;
        extractedText = parsed.extractedText || '';

        const eqs = Array.isArray(parsed.equations) ? parsed.equations : [];
        equationsJson = JSON.stringify(eqs);

        const diag = parsed.existingDiagram || parsed.diagram || {};
        diagramDescription = diag.description || (diag.steps ? 'Steps: ' + diag.steps.join(' → ') : '');
        diagramJson = JSON.stringify(diag);
        keyPointsJson = JSON.stringify(Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []);

        extractedContent = enrichItemsWithSvgs(parsed.extractedContent || []);

        // Crop & preserve original educational diagrams if present
        const detectedDiagrams = Array.isArray(parsed.diagramsPresent)
          ? parsed.diagramsPresent
          : (parsed.diagram && typeof parsed.diagram === 'object' && Object.keys(parsed.diagram).length > 0 ? [parsed.diagram] : []);

        if (imagePath && detectedDiagrams.length > 0) {
          const preservedDiagrams = await extractAndCropDiagrams({
            imagePath,
            diagrams: detectedDiagrams,
            prefix: contentId,
          });

          if (preservedDiagrams.length > 0) {
            diag.preservedDiagrams = preservedDiagrams;
            diagramJson = JSON.stringify(diag);

            preservedDiagrams.forEach((pd) => {
              extractedContent.push({
                type: 'diagram',
                content: pd.title,
                explanation: pd.description || 'Preserved original lecture illustration.',
                variables: {},
                visualizationRequired: true,
                visualizationType: 'preserved_source_diagram',
                visualizationDescription: pd.description,
                visualizationSpec: {
                  title: pd.title,
                  caption: pd.description,
                  imagePath: pd.imagePath,
                  labels: pd.labels,
                  isSourceDiagram: true,
                },
                imagePath: pd.imagePath,
                isSourceDiagram: true,
                svg: generateDiagramSvg({
                  visualizationType: 'preserved_source_diagram',
                  title: pd.title,
                  caption: pd.description,
                  imagePath: pd.imagePath,
                  labels: pd.labels,
                }),
              });
            });
          }
        }

        structuredContentJson = JSON.stringify(extractedContent);

        if (extractedContent.length === 0) {
          const heuristic = generateHeuristicConcept(extractedText, eqs);
          if (heuristic) {
            extractedContent = heuristic.extractedContent;
            if (imagePath && extractedContent.length > 0) {
              extractedContent[0].imagePath = imagePath;
              if (extractedContent[0].visualizationSpec) {
                extractedContent[0].visualizationSpec.imagePath = imagePath;
              }
            }
            structuredContentJson = JSON.stringify(extractedContent);
          }
        }
      } else {
        slideTitle = 'Lecture Presentation';
        extractedText = `Shared screen slide captured at ${Math.round(timestamp)}s`;
      }
    } catch (err) {
      console.warn('[Vision Screen] Vision AI error:', err.message);
      slideTitle = 'Screen Content';
      extractedText = `Shared screen slide captured at ${Math.round(timestamp)}s`;
    }
  } else {
    slideTitle = 'Shared Screen Slide';
    extractedText = `Slide content captured at ${Math.round(timestamp)}s`;
  }

  if (!extractedContent || extractedContent.length === 0) {
    const heuristic = generateHeuristicConcept(extractedText || slideTitle, []);
    if (heuristic) {
      extractedContent = heuristic.extractedContent;
      if (imagePath && extractedContent.length > 0) {
        extractedContent[0].imagePath = imagePath;
        if (extractedContent[0].visualizationSpec) {
          extractedContent[0].visualizationSpec.imagePath = imagePath;
        }
      }
      structuredContentJson = JSON.stringify(extractedContent);
    }
  }

  let equations = [], diagram = {}, keyPoints = [], conceptDiagram = {};
  try { equations = JSON.parse(equationsJson); } catch (_) {}
  try { diagram = JSON.parse(diagramJson); } catch (_) {}
  try { keyPoints = JSON.parse(keyPointsJson); } catch (_) {}
  try { conceptDiagram = JSON.parse(conceptDiagramJson); } catch (_) {}

  // ── Smart Deduplication & Quality Selection ──
  const currentSnapshot = {
    id: contentId,
    lectureId: resolvedLectureId,
    timestamp,
    imagePath,
    slideTitle,
    extractedText,
    codeSnippet,
    codeLanguage,
    equations,
    diagramDescription,
    diagram,
    keyPoints,
    mainConcept,
    conceptDiagram,
    extractedContent,
    imageHash,
  };

  const newScore = calculateSnapshotQualityScore(currentSnapshot);
  currentSnapshot.qualityScore = newScore;

  // Check recent screen snapshots for deduplication
  let matchRow = null;
  try {
    const recentRows = await all(
      'SELECT * FROM screen_contents WHERE lecture_id = ? ORDER BY timestamp DESC LIMIT 8',
      [resolvedLectureId]
    );
    for (const r of recentRows) {
      if (isDuplicateOrSameTopic(r, currentSnapshot)) {
        matchRow = r;
        break;
      }
    }
  } catch (err) {
    console.warn('[Deduplication] Query error:', err.message);
  }

  if (matchRow) {
    const existingScore = matchRow.quality_score || calculateSnapshotQualityScore(matchRow);
    if (newScore >= existingScore) {
      // NEW snapshot is BETTER or EQUAL -> UPGRADE existing record!
      await run(
        `UPDATE screen_contents SET
           timestamp = ?,
           image_path = COALESCE(?, image_path),
           slide_title = ?,
           extracted_text = ?,
           code_snippet = ?,
           diagram_description = ?,
           equations_json = ?,
           diagram_json = ?,
           code_language = ?,
           key_points_json = ?,
           concept_diagram_json = ?,
           main_concept = ?,
           structured_content_json = ?,
           image_hash = ?,
           quality_score = ?
         WHERE id = ?`,
        [timestamp, imagePath, slideTitle, extractedText, codeSnippet, diagramDescription,
         equationsJson, diagramJson, codeLanguage, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson,
         imageHash, newScore, matchRow.id]
      ).catch(() => {});

      return {
        ...currentSnapshot,
        id: matchRow.id,
        isUpdate: true,
        replacedId: matchRow.id,
        qualityScore: newScore,
        message: 'Upgraded existing presentation slide with higher clarity & formulas',
      };
    } else {
      // EXISTING snapshot was ALREADY BETTER -> Keep existing!
      let exEqs = [], exDiag = {}, exKps = [], exConc = {}, exExt = [];
      try { exEqs = JSON.parse(matchRow.equations_json || '[]'); } catch (_) {}
      try { exDiag = JSON.parse(matchRow.diagram_json || '{}'); } catch (_) {}
      try { exKps = JSON.parse(matchRow.key_points_json || '[]'); } catch (_) {}
      try { exConc = JSON.parse(matchRow.concept_diagram_json || '{}'); } catch (_) {}
      try { exExt = JSON.parse(matchRow.structured_content_json || '[]'); } catch (_) {}

      return {
        id: matchRow.id,
        lectureId: resolvedLectureId,
        timestamp: matchRow.timestamp,
        slideTitle: matchRow.slide_title,
        extractedText: matchRow.extracted_text,
        codeSnippet: matchRow.code_snippet,
        codeLanguage: matchRow.code_language,
        equations: exEqs,
        diagramDescription: matchRow.diagram_description,
        diagram: exDiag,
        keyPoints: exKps,
        mainConcept: matchRow.main_concept,
        conceptDiagram: exConc,
        extractedContent: exExt,
        qualityScore: existingScore,
        isDuplicate: true,
        keptExistingId: matchRow.id,
        message: 'Preserved existing presentation slide with higher educational clarity',
      };
    }
  }

  // Persist new unique slide
  await run(
    `INSERT INTO screen_contents
     (id, lecture_id, timestamp, image_path, slide_title, extracted_text, code_snippet, diagram_description,
      equations_json, diagram_json, code_language, key_points_json, concept_diagram_json, main_concept, structured_content_json, image_hash, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contentId, resolvedLectureId, timestamp, imagePath,
     slideTitle, extractedText, codeSnippet, diagramDescription,
     equationsJson, diagramJson, codeLanguage, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson, imageHash, newScore]
  ).catch(async () => {
    await run(
      `INSERT INTO screen_contents
       (id, lecture_id, timestamp, image_path, slide_title, extracted_text, code_snippet, diagram_description,
        equations_json, diagram_json, code_language, key_points_json, concept_diagram_json, main_concept, structured_content_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [contentId, resolvedLectureId, timestamp, imagePath,
       slideTitle, extractedText, codeSnippet, diagramDescription,
       equationsJson, diagramJson, codeLanguage, keyPointsJson, conceptDiagramJson, mainConcept, structuredContentJson]
    );
  });

  // Record multimodal event
  await run(
    `INSERT INTO multimodal_events (id, lecture_id, timestamp, title, event_type, visual_content, combined_insight)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'evt_' + uuidv4().slice(0, 8), resolvedLectureId, timestamp,
      slideTitle, 'SCREEN',
      `${slideTitle}: ${extractedText}`.trim(),
      diagramDescription || 'Slide presentation analyzed.',
    ]
  );

  return currentSnapshot;
}

module.exports = {
  processBoardFrame,
  processScreenFrame,
  enrichItemsWithSvgs,
  generateHeuristicConcept,
  visionAnalysisCache,
  isDuplicateOrSameTopic,
  calculateSnapshotQualityScore,
};
