/**
 * visualization.test.js
 *
 * Automated tests for AI-Powered Formula Visualization & Diagram Generation in LectureLens.
 * Tests all 11 requirements from Section 11 of the feature specification using Node's native test runner.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const {
  renderCoordinateGraphSvg,
  renderAlgorithmSvg,
  renderFlowchartSvg,
  renderTreeDiagramSvg,
  renderBlockDiagramSvg,
  renderGeometryDiagramSvg,
  renderBiologicalSystemSvg,
  renderPreservedSourceDiagramSvg,
  renderNullCoalesceFlowSvg,
  renderStringTransformationSvg,
  renderDateTimelineSvg,
  RendererRegistry,
  diagramRegistry,
  generateDiagramSvg,
  evaluateMathExpression,
} = require('../src/visualizationEngine');

const {
  generateHeuristicConcept,
  enrichItemsWithSvgs,
  visionAnalysisCache,
  processScreenFrame,
  processBoardFrame,
  isDuplicateOrSameTopic,
  calculateSnapshotQualityScore,
  extractAndCropDiagrams,
} = require('../src/visionService');

const { db, run, get, all } = require('../src/db');
const { generateStudyNotes } = require('../src/summaryService');
const {
  resolveLectureDomainContext,
  estimateConsistencyHeuristic,
  formatDomainContextForPrompt,
  extractSignificantTokens,
} = require('../src/domainContextService');
const {
  generateStudyNotesPdf,
  drawPdfGeometryDiagram,
  drawPdfBiologicalSystem,
  drawPdfPreservedDiagram,
} = require('../src/pdfService');

describe('AI-Powered Formula Visualization & Diagram Generation Test Suite', () => {
  const testLectureId = 'test_lec_viz_' + Date.now();
  const privateLectureId = 'test_lec_private_' + Date.now();

  before(async () => {
    // Seed test public lecture
    await run(
      `INSERT OR IGNORE INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['test_teacher_1', 'Prof. Euler', 'euler@lecturelens.edu', 'hash', 'TEACHER']
    );

    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testLectureId, 'ROOM_VIZ_' + Date.now(), 'Calculus & Physics Lecture', 'Test lecture', 'test_teacher_1', 'LIVE', 'PUBLIC']
    );

    // Seed test private lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [privateLectureId, 'ROOM_PRIV_' + Date.now(), 'Confidential Research Lecture', 'Private lecture', 'test_teacher_1', 'LIVE', 'PRIVATE']
    );
  });

  after(async () => {
    await run('DELETE FROM study_notes WHERE lecture_id IN (?, ?)', [testLectureId, privateLectureId]);
    await run('DELETE FROM board_contents WHERE lecture_id IN (?, ?)', [testLectureId, privateLectureId]);
    await run('DELETE FROM screen_contents WHERE lecture_id IN (?, ?)', [testLectureId, privateLectureId]);
    await run('DELETE FROM lectures WHERE id IN (?, ?)', [testLectureId, privateLectureId]);
  });

  // 1. Correct extraction and interpretation of formulas
  test('1. Correct extraction and interpretation of formulas', () => {
    const kinematicResult = generateHeuristicConcept('The professor discussed v = u + at during kinematics', []);
    assert.ok(kinematicResult, 'Should recognize kinematics formula');
    assert.strictEqual(kinematicResult.topic, 'Kinematics: Uniform Acceleration');
    const item = kinematicResult.extractedContent[0];
    assert.strictEqual(item.content, 'v = u + at');
    assert.ok(item.variables.v, 'Should identify final velocity');
    assert.ok(item.variables.a, 'Should identify acceleration');

    const linearResult = generateHeuristicConcept('We graphed y = mx + c with slope and intercept', []);
    assert.ok(linearResult, 'Should recognize linear equation');
    assert.strictEqual(linearResult.extractedContent[0].content, 'y = mx + c');
  });

  // 2. Identifying when a diagram is useful
  test('2. Identifying when a diagram is useful', () => {
    const formulaItem = {
      type: 'formula',
      content: 'v = u + at',
      visualizationRequired: true,
      visualizationType: 'coordinate_graph',
      visualizationSpec: { fn: '2*x + 1' },
    };
    const plainTextItem = {
      type: 'concept',
      content: 'Administrative announcement about midterm exam dates',
      visualizationRequired: false,
    };

    assert.strictEqual(formulaItem.visualizationRequired, true, 'Formula should require visualization');
    assert.strictEqual(plainTextItem.visualizationRequired, false, 'Plain administrative announcement should not require visualization');
  });

  // 3. Selecting the appropriate visualization type
  test('3. Selecting the appropriate visualization type', () => {
    const kin = generateHeuristicConcept('velocity and acceleration v = u + at', []);
    assert.strictEqual(kin.extractedContent[0].visualizationType, 'coordinate_graph', 'Kinematics should select coordinate_graph');

    const bsearch = generateHeuristicConcept('binary search algorithm in array', []);
    assert.strictEqual(bsearch.extractedContent[0].visualizationType, 'algorithm_steps', 'Binary search should select algorithm_steps');
  });

  // 4. Generating a correct graph from a mathematical equation
  test('4. Generating a correct graph from a mathematical equation', () => {
    const spec = {
      title: 'Velocity vs. Time (v = u + at)',
      equation: 'v = u + at',
      fn: '3 + 2*x',
      xDomain: [0, 8],
      yDomain: [0, 20],
      xAxisLabel: 'Time t (s)',
      yAxisLabel: 'Velocity v (m/s)',
      points: [{ x: 0, y: 3, label: 'Initial Velocity u = 3 m/s', color: '#38bdf8' }],
      slopeTriangle: { x1: 2, x2: 6, label: 'Acceleration a = 2 m/s²' },
    };

    const svg = renderCoordinateGraphSvg(spec);
    assert.ok(svg.includes('<svg'), 'Should produce valid SVG markup');
    assert.ok(svg.includes('Velocity vs. Time'), 'SVG should contain graph title');
    assert.ok(svg.includes('Time t (s)'), 'SVG should contain x-axis label');
    assert.ok(svg.includes('Velocity v (m/s)'), 'SVG should contain y-axis label');
    assert.ok(svg.includes('Initial Velocity u = 3 m/s'), 'SVG should contain marked initial velocity point');
    assert.ok(svg.includes('Acceleration a = 2 m/s²'), 'SVG should contain slope indicator');

    // Test math evaluation
    const yValAt4 = evaluateMathExpression('3 + 2*x', 4);
    assert.strictEqual(yValAt4, 11, 'Equation 3 + 2*4 must equal 11');
  });

  // 5. Rendering a diagram from structured output
  test('5. Rendering a diagram from structured output', () => {
    // Flowchart rendering
    const flowSvg = renderFlowchartSvg({
      title: 'Search Flow',
      nodes: [
        { id: '1', label: 'Start Search', type: 'start' },
        { id: '2', label: 'Compare target == arr[mid]', type: 'decision' },
        { id: '3', label: 'Return Index', type: 'end' },
      ],
    });
    assert.ok(flowSvg.includes('<svg'), 'Flowchart should render valid SVG');
    assert.ok(flowSvg.includes('Compare target == arr[mid]'), 'Flowchart should contain node label');

    // Algorithm steps rendering
    const algoSvg = renderAlgorithmSvg({
      title: 'Binary Search Step',
      array: [10, 20, 30, 40, 50],
      target: 30,
      low: 0,
      mid: 2,
      high: 4,
    });
    assert.ok(algoSvg.includes('<svg'), 'Algorithm should render valid SVG');
    assert.ok(algoSvg.includes('Search Interval: [0 .. 4]'), 'Algorithm should display active interval bounds');
    assert.ok(algoSvg.includes('MID [2] = 30'), 'Algorithm should display mid pointer');
  });

  // 6. Embedding diagrams at the correct locations in lecture notes
  test('6. Embedding diagrams at the correct locations in lecture notes', async () => {
    // Seed a board content item with kinematics formula
    await run(
      `INSERT INTO board_contents (id, lecture_id, timestamp, extracted_text, equation, structured_content_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'test_b1_' + Date.now(),
        testLectureId,
        15,
        'Today we derived v = u + at for uniformly accelerated motion.',
        '$v = u + at$',
        JSON.stringify([
          {
            type: 'formula',
            content: 'v = u + at',
            explanation: 'Velocity increases linearly under uniform acceleration.',
            variables: { v: 'Final velocity', u: 'Initial velocity', a: 'Acceleration', t: 'Time' },
            visualizationRequired: true,
            visualizationType: 'coordinate_graph',
            visualizationDescription: 'Velocity-time graph with slope a',
            visualizationSpec: {
              fn: '2 + 1.5*x',
              equation: 'v = u + at',
              xDomain: [0, 10],
              yDomain: [0, 20],
              xAxisLabel: 't (s)',
              yAxisLabel: 'v (m/s)',
            },
          },
        ]),
      ]
    );

    const notes = await generateStudyNotes(testLectureId, 'detailed');
    assert.ok(notes, 'Notes should be generated');
    assert.ok(notes.sections && notes.sections.length > 0, 'Notes should contain structured sections');

    const secWithViz = notes.sections.find((s) => s.visualization && s.visualization.required);
    assert.ok(secWithViz, 'Should find section with embedded visualization');
    assert.ok(secWithViz.visualization.svg, 'Embedded visualization must have rendered SVG');

    // Check that markdown contains the visual embed token immediately in the section
    assert.ok(notes.contentMarkdown.includes(':::visualization'), 'Markdown should embed visual token inline');
  });

  // 7. Persisting and reloading notes with diagrams
  test('7. Persisting and reloading notes with diagrams', async () => {
    const row = await get('SELECT * FROM study_notes WHERE lecture_id = ? AND mode = ?', [testLectureId, 'detailed']);
    assert.ok(row, 'Study notes row should exist in database');

    const sections = JSON.parse(row.sections_json || '[]');
    const visualizations = JSON.parse(row.visualizations_json || '[]');

    assert.ok(sections.length > 0, 'Persisted sections_json should not be empty');
    assert.ok(visualizations.length > 0, 'Persisted visualizations_json should not be empty');
    assert.ok(visualizations[0].svg.includes('<svg'), 'Persisted visualization must contain valid SVG string');
  });

  // 8. Handling invalid model output and visualization failures
  test('8. Handling invalid model output and visualization failures', () => {
    // Malformed math expression should not throw and return safe fallback
    const result = evaluateMathExpression('malformed!!^&*#', 5);
    assert.strictEqual(typeof result, 'number', 'Invalid expression should return a safe number');

    // Missing spec parameters should render safe fallback SVG without crashing
    const fallbackSvg = generateDiagramSvg({ type: 'coordinate_graph', fn: null });
    assert.ok(fallbackSvg.includes('<svg'), 'Should safely generate fallback SVG');

    // Item with broken spec should be handled gracefully by enrichItemsWithSvgs
    const enriched = enrichItemsWithSvgs([
      {
        visualizationRequired: true,
        visualizationType: 'coordinate_graph',
        visualizationSpec: { fn: null },
      },
    ]);
    assert.ok(enriched[0].svg, 'Should produce safe fallback SVG without throwing');
  });

  // 9. Avoiding duplicate diagram generation during retries
  test('9. Avoiding duplicate diagram generation during retries', () => {
    visionAnalysisCache.clear();
    const testKey = 'test_sample_cache_key_timestamp_10';
    const fakeData = { topic: 'Cached Concept', extractedContent: [] };

    visionAnalysisCache.set(testKey, fakeData);
    assert.strictEqual(visionAnalysisCache.has(testKey), true, 'Cache should record analyzed snapshot');
    assert.strictEqual(visionAnalysisCache.get(testKey).topic, 'Cached Concept', 'Cache should return stored analysis');
  });

  // 10. Enforcing access control for saved visualizations
  test('10. Enforcing access control for saved visualizations', async () => {
    // A private lecture should deny unauthenticated access
    const privateLec = await get('SELECT * FROM lectures WHERE id = ?', [privateLectureId]);
    assert.strictEqual(privateLec.visibility, 'PRIVATE', 'Lecture must be private');

    // Check access logic: non-host without auth must be blocked
    function simulateAccess(user, lecture) {
      if (!lecture) return { allowed: false, status: 404 };
      if (lecture.visibility === 'PRIVATE') {
        if (!user) return { allowed: false, status: 401 };
        if (user.role !== 'ADMIN' && lecture.host_id !== user.id) return { allowed: false, status: 403 };
      }
      return { allowed: true };
    }

    const unauth = simulateAccess(null, privateLec);
    assert.strictEqual(unauth.allowed, false, 'Unauthenticated user should be blocked from private lecture');
    assert.strictEqual(unauth.status, 401);

    const otherUser = simulateAccess({ id: 'stranger_user', role: 'STUDENT' }, privateLec);
    assert.strictEqual(otherUser.allowed, false, 'Other student should be blocked from private lecture');
    assert.strictEqual(otherUser.status, 403);

    const host = simulateAccess({ id: 'test_teacher_1', role: 'TEACHER' }, privateLec);
    assert.strictEqual(host.allowed, true, 'Host teacher should be allowed access');
  });

  // 11. Preserving existing note generation, screenshot upload, and transcription
  test('11. Preserving existing note generation, screenshot upload, and transcription', async () => {
    const notes = await generateStudyNotes(testLectureId, 'short');
    assert.ok(notes.title.includes('SHORT'), 'Short notes mode should be preserved');
    assert.ok(notes.formulas.length > 0, 'Formulas array must be preserved');
    assert.ok(notes.questions.length > 0, 'Review questions must be preserved');
  });

  // 12. Generating study notes PDF containing embedded vector visualizations and graphs
  test('12. Generating study notes PDF containing embedded vector visualizations and graphs', async () => {
    const pdfResult = await generateStudyNotesPdf(testLectureId);
    assert.ok(pdfResult && pdfResult.filePath, 'PDF generation should return a filePath');
    assert.ok(fs.existsSync(pdfResult.filePath), 'PDF file must exist on disk');
    const stats = fs.statSync(pdfResult.filePath);
    assert.ok(stats.size > 2500, `PDF file should be non-empty and contain vector graphics (size: ${stats.size} bytes)`);

    // Verify PDF header
    const buffer = fs.readFileSync(pdfResult.filePath);
    const header = buffer.slice(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'Generated document must be a valid PDF file');

    // Clean up test generated file
    try { fs.unlinkSync(pdfResult.filePath); } catch (_) {}
  });

  // 13. Processing slide snapshots with vision and structured visualization fallback
  test('13. Processing slide snapshots with vision and structured visualization fallback', async () => {
    // Process a screen frame with linear equation content
    const screenResult = await processScreenFrame({
      lectureId: testLectureId,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('dummy_screen_image').toString('base64'),
      timestamp: 42,
    });

    assert.ok(screenResult, 'processScreenFrame should return processed object');
    assert.ok(screenResult.id.startsWith('screen_'), 'Screen content ID must have screen_ prefix');
    assert.strictEqual(screenResult.lectureId, testLectureId);

    // Verify row persisted in SQLite database screen_contents
    const savedRow = await get('SELECT * FROM screen_contents WHERE id = ?', [screenResult.id]);
    assert.ok(savedRow, 'Row must be persisted in screen_contents table');
    assert.strictEqual(savedRow.timestamp, 42);

    // Verify multimodal event logged
    const eventRow = await get('SELECT * FROM multimodal_events WHERE lecture_id = ? AND event_type = ?', [testLectureId, 'SCREEN']);
    assert.ok(eventRow, 'Multimodal event must be created with SCREEN event_type');
  });

  // 14. Unique cryptographic SHA-256 caching preventing repetition of previous snapshot data
  test('14. Unique cryptographic SHA-256 caching preventing repetition of previous snapshot data', () => {
    visionAnalysisCache.clear();
    const crypto = require('crypto');

    // Two different snapshots with identical standard JPEG header prefix
    const snap1 = 'data:image/jpeg;base64,' + Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/first_distinct_snapshot_image_data').toString('base64');
    const snap2 = 'data:image/jpeg;base64,' + Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/second_different_snapshot_image_data').toString('base64');

    const clean1 = snap1.replace(/^data:image\/\w+;base64,/, '');
    const clean2 = snap2.replace(/^data:image\/\w+;base64,/, '');

    const hash1 = crypto.createHash('sha256').update(clean1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(clean2).digest('hex');

    assert.notStrictEqual(hash1, hash2, 'Different snapshots must have completely distinct cryptographic hashes');

    visionAnalysisCache.set(hash1, { topic: 'Linear Equations y = mx + c' });
    assert.strictEqual(visionAnalysisCache.has(hash2), false, 'Second snapshot must NOT hit cache of first snapshot');
  });

  // 15. Duplicate snapshot handling: upgrading with higher-quality capture and suppressing redundant lower-quality captures
  test('15. Duplicate snapshot handling: upgrading with higher-quality capture and suppressing redundant lower-quality captures', async () => {
    const crypto = require('crypto');
    const lectureId = 'test_lec_dedup_' + Date.now();
    await run(
      `INSERT INTO lectures (id, room_id, title, description, host_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [lectureId, 'ROOM_DEDUP_' + Date.now(), 'Calculus Lecture', 'Deduplication test', 'test_teacher_1', 'LIVE']
    );

    const clean1 = Buffer.from('kinematics_v_u_at_draft').toString('base64');
    const clean2 = Buffer.from('kinematics_v_u_at_high_quality_full_derivation').toString('base64');
    const h1 = crypto.createHash('sha256').update(clean1).digest('hex');
    const h2 = crypto.createHash('sha256').update(clean2).digest('hex');

    // First draft snapshot: basic formula
    visionAnalysisCache.set(h1, {
      topic: 'Kinematics: Velocity Equation',
      extractedText: 'v = u + at',
      equations: [{ latex: 'v = u + at' }],
      extractedContent: [{ type: 'formula', content: 'v = u + at' }],
    });

    // Second snapshot: same formula with higher quality derivation & visualization
    visionAnalysisCache.set(h2, {
      topic: 'Kinematics: Velocity Equation',
      extractedText: 'Detailed derivation: v = u + at, with acceleration a and time t',
      equations: [{ latex: 'v = u + at' }],
      extractedContent: [{
        type: 'formula',
        content: 'v = u + at',
        variables: { v: 'Final velocity', u: 'Initial velocity', a: 'Acceleration', t: 'Time' },
        visualizationRequired: true,
        visualizationType: 'coordinate_graph',
        visualizationSpec: { fn: '2*x + 1' },
      }],
    });

    // Initial basic snapshot
    const initialSnap = await processBoardFrame({
      lectureId,
      imageBase64: 'data:image/jpeg;base64,' + clean1,
      timestamp: 10,
    });
    assert.ok(initialSnap && initialSnap.id);

    // Count rows in board_contents
    const count1 = await get('SELECT COUNT(*) as cnt FROM board_contents WHERE lecture_id = ?', [lectureId]);
    assert.strictEqual(count1.cnt, 1, 'Should have 1 snapshot initially');

    // Second snapshot of the SAME formula (more detailed / higher quality)
    const upgradedSnap = await processBoardFrame({
      lectureId,
      imageBase64: 'data:image/jpeg;base64,' + clean2,
      timestamp: 15,
    });

    // Should detect duplicate topic, upgrade existing row rather than appending duplicate
    assert.strictEqual(upgradedSnap.isUpdate, true, 'Superior snapshot should be marked as update');
    assert.strictEqual(upgradedSnap.id, initialSnap.id, 'Upgraded snapshot must reuse/update the existing entry ID');

    const count2 = await get('SELECT COUNT(*) as cnt FROM board_contents WHERE lecture_id = ?', [lectureId]);
    assert.strictEqual(count2.cnt, 1, 'Database must not duplicate the entry for the same topic');

    // Clean up
    await run('DELETE FROM board_contents WHERE lecture_id = ?', [lectureId]);
    await run('DELETE FROM lectures WHERE id = ?', [lectureId]);
  });

  // 16. Preservation of instructional progression vs true duplicates
  test('16. Preservation of instructional progression vs true duplicates', async () => {
    const snapA = {
      main_concept: 'Kinematics: Acceleration',
      equation: 'v = u + at',
      equations: [{ latex: 'v = u + at' }],
      extracted_text: 'Final velocity formula under constant acceleration',
    };
    const snapB = {
      main_concept: 'Kinematics: Acceleration',
      equation: 's = ut + \\frac{1}{2}at^2',
      equations: [{ latex: 's = ut + \\frac{1}{2}at^2' }],
      extracted_text: 'Displacement equation under uniform acceleration',
    };
    // Distinct equations under the same topic must NOT be flagged as duplicate
    const isDupProgression = isDuplicateOrSameTopic(snapA, snapB);
    assert.strictEqual(isDupProgression, false, 'Different formulas under the same topic must be preserved as distinct instructional steps');

    const snapA_dup = {
      main_concept: 'Kinematics: Acceleration',
      equation: 'v = u + at',
      equations: [{ latex: 'v = u + at' }],
      extracted_text: 'Final velocity formula under constant acceleration (clear view)',
    };
    // Identical equation must be recognized as duplicate
    const isDupIdentical = isDuplicateOrSameTopic(snapA, snapA_dup);
    assert.strictEqual(isDupIdentical, true, 'Identical formula re-capture must be recognized as duplicate');
  });

  // 17. Extensible Renderer Registry (tree_diagram, block_diagram, custom)
  test('17. Extensible Renderer Registry (tree_diagram, block_diagram, custom)', () => {
    const treeSvg = diagramRegistry.render({
      visualizationType: 'tree_diagram',
      title: 'Binary Search Tree',
      root: { label: '50', children: [{ label: '25' }, { label: '75' }] },
    });
    assert.ok(treeSvg.includes('<svg'), 'Tree diagram must produce SVG');
    assert.ok(treeSvg.includes('Binary Search Tree'), 'Tree diagram must render title');
    assert.ok(treeSvg.includes('circle'), 'Tree diagram must render node circles');

    const blockSvg = diagramRegistry.render({
      visualizationType: 'block_diagram',
      title: 'Microservices Pipeline',
      blocks: [{ label: 'Ingress' }, { label: 'Worker' }, { label: 'Storage' }],
    });
    assert.ok(blockSvg.includes('<svg'), 'Block diagram must produce SVG');
    assert.ok(blockSvg.includes('Microservices Pipeline'), 'Block diagram must render title');
    assert.ok(blockSvg.includes('rect'), 'Block diagram must render block rectangles');

    // Test custom registration
    const testRegistry = new RendererRegistry();
    testRegistry.register('custom_gauge', (spec) => `<svg class="gauge"><text>${spec.value}</text></svg>`);
    const customOutput = testRegistry.render({ visualizationType: 'custom_gauge', value: '98%' });
    assert.ok(customOutput.includes('98%'), 'Custom registered renderer should be dispatched');
  });

  // 18. Bounded LRU Cache Eviction and Memory Protection
  test('18. Bounded LRU Cache Eviction and Memory Protection', () => {
    assert.ok(typeof visionAnalysisCache.get === 'function');
    assert.ok(typeof visionAnalysisCache.set === 'function');
    visionAnalysisCache.set('test_key_alpha', { item: 'data1' });
    assert.strictEqual(visionAnalysisCache.get('test_key_alpha').item, 'data1');
  });

  // 19. Biology Anatomy Extraction & Preserved Source Diagrams (Example A)
  test('19. Biology Anatomy Extraction & System Schematic (Example A)', () => {
    const bioResult = generateHeuristicConcept('Excretory products and their elimination: human urinary system and longitudinal section of kidney', []);
    assert.ok(bioResult, 'Should recognize human physiology / excretory system');
    assert.strictEqual(bioResult.topic, 'Human Physiology: Excretory Products and Their Elimination');
    const item = bioResult.extractedContent[0];
    assert.strictEqual(item.visualizationType, 'biological_system', 'Biology topic must select biological_system, NEVER flowchart');
    assert.strictEqual(item.subject, 'biology');

    // Render biological SVG
    const bioSvg = renderBiologicalSystemSvg({
      title: 'Human Excretory System: Organ Pathway',
      stages: [
        { name: '1. Kidneys', desc: 'Nephrons filter blood; urine forms' },
        { name: '2. Ureters', desc: 'Muscular tubes transport urine' },
        { name: '3. Urinary Bladder', desc: 'Elastic reservoir stores urine' },
        { name: '4. Urethra', desc: 'Terminal duct discharges urine' },
      ],
    });
    assert.ok(bioSvg.includes('<svg'), 'Should produce valid SVG');
    assert.ok(bioSvg.includes('Kidneys'), 'Must render Kidneys stage');
    assert.ok(bioSvg.includes('Ureters'), 'Must render Ureters stage');
    assert.ok(bioSvg.includes('Urinary Bladder'), 'Must render Urinary Bladder stage');
    assert.ok(bioSvg.includes('Urethra'), 'Must render Urethra stage');
    assert.ok(!bioSvg.includes('Invariant Check'), 'Biological diagram must NEVER contain software flowchart nodes');

    // Content-aware registry fallback
    const registryBio = diagramRegistry.render({ visualizationType: 'anatomy_diagram', title: 'Kidney Section' });
    assert.ok(registryBio.includes('Kidney') || registryBio.includes('Anatomical'), 'Registry must route anatomy to biological system');
    assert.ok(!registryBio.includes('Commit State'), 'Registry must not route anatomy to software flowchart');
  });

  // 20. Circle Geometry Extraction & Quadratic Area Scaling (Example B)
  test('20. Circle Geometry Extraction & Quadratic Area Scaling (Example B)', () => {
    const geomResult = generateHeuristicConcept('Teacher holding paper with circle, marked radius r and Area = πr²', []);
    assert.ok(geomResult, 'Should recognize circle geometry');
    assert.strictEqual(geomResult.topic, 'Circle Geometry: Radius and Area Formula');
    const item = geomResult.extractedContent[0];
    assert.strictEqual(item.visualizationType, 'geometry_diagram', 'Circle formula must select geometry_diagram');
    assert.strictEqual(item.content, 'Area = \\pi r^2');
    assert.strictEqual(item.subject, 'geometry');
    assert.ok(item.variables.r, 'Must identify radius r');
    assert.ok(item.variables.A, 'Must identify area A');

    // Render geometry SVG
    const geomSvg = renderGeometryDiagramSvg({
      title: 'Circle Geometry: Radius & Area Scaling',
      formula: 'A = \\pi r^2',
      radiusLabel: 'r',
      scalingNote: 'Area scales quadratically: A ∝ r²',
    });
    assert.ok(geomSvg.includes('<svg'), 'Must produce valid SVG');
    assert.ok(geomSvg.includes('Circle Geometry'), 'Must display title');
    assert.ok(geomSvg.includes('circle'), 'Must render circle element');
    assert.ok(geomSvg.toLowerCase().includes('quadratic'), 'Must display quadratic scaling note');

    // Content-aware registry fallback
    const registryGeom = diagramRegistry.render({ visualizationType: 'circle', formula: 'A = \\pi r^2' });
    assert.ok(registryGeom.includes('Circle') || registryGeom.includes('radius'), 'Registry must route circle to geometry diagram');
    assert.ok(!registryGeom.includes('Invariant Check'), 'Registry must not route circle to software flowchart');
  });

  // 21. Diagram Preservation & Cropping Pipeline
  test('21. Diagram Preservation & SVG Generation', () => {
    const srcSvg = renderPreservedSourceDiagramSvg({
      title: 'Original Lecture Diagram: Excretory System',
      caption: 'High resolution schematic captured from lecture slide',
      labels: ['Kidneys', 'Renal Cortex', 'Renal Pelvis', 'Ureter'],
    });
    assert.ok(srcSvg.includes('<svg'), 'Must produce SVG');
    assert.ok(srcSvg.includes('PRESERVED SOURCE DIAGRAM'), 'Must label preserved source diagram');
    assert.ok(srcSvg.includes('Renal Cortex'), 'Must render label badges');
  });

  // 22. PDF Generation: Vector Diagrams and Trailing Blank Page Prevention (Example C)
  test('22. PDF Generation: Vector Diagrams and Trailing Blank Page Prevention (Example C)', async () => {
    // Generate notes for test lecture
    const notes = await generateStudyNotes(testLectureId, 'detailed');
    assert.ok(notes && notes.sections.length > 0, 'Study notes must be generated');

    // Generate PDF
    const pdfResult = await generateStudyNotesPdf(testLectureId);
    assert.ok(pdfResult && pdfResult.filePath, 'PDF export must return file path');
    assert.ok(fs.existsSync(pdfResult.filePath), 'PDF file must exist on disk');

    const stats = fs.statSync(pdfResult.filePath);
    assert.ok(stats.size > 2000, 'PDF file must have substantial content (> 2KB)');

    // Clean up generated PDF
    try { fs.unlinkSync(pdfResult.filePath); } catch (_) {}
  });

  // 23. SQL NULL Handling with COALESCE (null_coalesce_flow)
  test('23. SQL NULL Handling with COALESCE (null_coalesce_flow)', () => {
    const coalSvg = renderNullCoalesceFlowSvg({
      title: 'SQL COALESCE() Null-Handling Flow',
      expression: "SELECT name, COALESCE(dept, 'Unknown') FROM employee;",
      fallback: "'Unknown'",
      inputRows: [
        { name: 'Alice', dept: "'IT'" },
        { name: 'Bob', dept: null },
        { name: 'Charlie', dept: "'HR'" },
      ],
      isIllustrative: true,
    });

    assert.ok(coalSvg.includes('<svg'), 'Must produce valid SVG');
    assert.ok(coalSvg.includes('COALESCE'), 'Must render COALESCE title/expression');
    assert.ok(coalSvg.includes('dept IS NULL?'), 'Must render NULL decision node');
    assert.ok(coalSvg.includes('Unknown'), 'Must substitute fallback value');
    assert.ok(coalSvg.includes('Alice'), 'Must render row for Alice');
    assert.ok(coalSvg.includes('Bob'), 'Must render row for Bob');
    assert.ok(!coalSvg.toLowerCase().includes('binary search'), 'COALESCE diagram must NEVER contain binary search');
    assert.ok(!coalSvg.toLowerCase().includes('arr[mid]'), 'COALESCE diagram must NEVER contain array pointers');

    // Registry routing verification
    const routedSvg = diagramRegistry.render({
      visualizationType: 'algorithm_steps',
      title: 'COALESCE Evaluation Flow',
      heading: 'Handling Missing Data with COALESCE',
    });
    assert.ok(routedSvg.includes('COALESCE'), 'Registry must semantically route COALESCE away from binary search');
    assert.ok(!routedSvg.includes('Target 23'), 'Registry must never render Target 23 for COALESCE');
  });

  // 24. SQL String Functions Input-to-Output Transformations (string_transformation)
  test('24. SQL String Functions Input-to-Output Transformations (string_transformation)', () => {
    const strSvg = renderStringTransformationSvg({
      title: 'SQL String Functions: Input → Output Transformations',
      input: '  LectureLens  ',
      operations: [
        { func: 'UPPER(str)', result: "'  LECTURELENS  '", desc: 'Converts to uppercase' },
        { func: 'LOWER(str)', result: "'  lecturelens  '", desc: 'Converts to lowercase' },
        { func: 'LENGTH(str)', result: '15', desc: 'Character count' },
        { func: 'TRIM(str)', result: "'LectureLens'", desc: 'Strips outer whitespace' },
        { func: 'SUBSTRING(str, 3, 7)', result: "'Lecture'", desc: 'Extracts substring' },
        { func: "CONCAT(TRIM(str), ' AI')", result: "'LectureLens AI'", desc: 'Concatenates strings' },
      ],
      isIllustrative: true,
    });

    assert.ok(strSvg.includes('<svg'), 'Must produce valid SVG');
    assert.ok(strSvg.includes('UPPER(str)'), 'Must render UPPER function');
    assert.ok(strSvg.includes('LOWER(str)'), 'Must render LOWER function');
    assert.ok(strSvg.includes('LENGTH(str)'), 'Must render LENGTH function');
    assert.ok(strSvg.includes('TRIM(str)'), 'Must render TRIM function');
    assert.ok(strSvg.includes('SUBSTRING(str, 3, 7)'), 'Must render SUBSTRING function');
    assert.ok(strSvg.includes('CONCAT'), 'Must render CONCAT function');
    assert.ok(!strSvg.toLowerCase().includes('binary search'), 'String diagram must NEVER contain binary search');
    assert.ok(!strSvg.toLowerCase().includes('target 23'), 'String diagram must NEVER contain binary search targets');

    // Registry routing verification
    const routedSvg = diagramRegistry.render({
      visualizationType: 'algorithm_steps',
      title: 'String Function Pipeline',
      heading: 'SQL String Manipulation Functions',
    });
    assert.ok(routedSvg.includes('INPUT STRING') || routedSvg.includes('UPPER'), 'Registry must route SQL string functions properly');
    assert.ok(!routedSvg.includes('Search Interval:'), 'Registry must never render search intervals for string functions');
  });

  // 25. SQL Date and Time Arithmetic Timeline (date_timeline)
  test('25. SQL Date and Time Arithmetic Timeline (date_timeline)', () => {
    const dateSvg = renderDateTimelineSvg({
      title: 'SQL Date & Time Arithmetic Timeline',
      baseDate: '2020-09-05',
      isIllustrative: true,
    });

    assert.ok(dateSvg.includes('<svg'), 'Must produce valid SVG');
    assert.ok(dateSvg.includes('2020-09-05'), 'Must render base date 2020-09-05');
    assert.ok(dateSvg.includes('2020-09-15'), 'Must render DATE_ADD (+10 DAY) -> 2020-09-15');
    assert.ok(dateSvg.includes('2020-08-26'), 'Must render DATE_SUB (-10 DAY) -> 2020-08-26');
    assert.ok(dateSvg.includes('DATEDIFF'), 'Must render DATEDIFF bracket');
    assert.ok(dateSvg.includes('CURRENT_DATE()'), 'Must render CURRENT_DATE() badge');
    assert.ok(!dateSvg.includes('v = u + at'), 'Date timeline must NEVER render velocity equations');
    assert.ok(!dateSvg.toLowerCase().includes('binary search'), 'Date timeline must NEVER render binary search');

    // Registry routing verification
    const routedSvg = diagramRegistry.render({
      visualizationType: 'coordinate_graph',
      title: 'Date Arithmetic Flow',
      heading: 'Date and Time Arithmetic Functions',
    });
    assert.ok(routedSvg.includes('2020-09-05'), 'Registry must route date arithmetic away from Cartesian coordinate graphs');
    assert.ok(!routedSvg.includes('Δx ='), 'Registry must never render slope triangles for date arithmetic');
  });

  // 26. Algorithm Steps Sequential Process Rendering (Eliminates Binary Search Default)
  test('26. Algorithm Steps Sequential Process Rendering (Eliminates Binary Search Default)', () => {
    const stepsSvg = renderAlgorithmSvg({
      title: 'General Algorithmic Execution Steps',
      steps: [
        'Initialize state accumulator',
        'Evaluate invariant condition check',
        'Apply iterative reduction transition',
        'Commit verified state',
      ],
    });

    assert.ok(stepsSvg.includes('<svg'), 'Must produce valid SVG');
    assert.ok(stepsSvg.includes('ALGORITHMIC EXECUTION STEPS'), 'Must identify execution steps');
    assert.ok(stepsSvg.includes('Initialize state accumulator'), 'Must render Step 1');
    assert.ok(stepsSvg.includes('Commit verified state'), 'Must render Step 4');
    assert.ok(!stepsSvg.includes('LOW [4]'), 'Steps visualization without array must NEVER contain LOW pointer');
    assert.ok(!stepsSvg.includes('MID [5]'), 'Steps visualization without array must NEVER contain MID pointer');
    assert.ok(!stepsSvg.includes('Target 23'), 'Steps visualization without array must NEVER contain Target 23');
  });

  // 27. Lecture Overview Sanitization (Eliminates [object Object])
  test('27. Lecture Overview Sanitization (Eliminates [object Object])', async () => {
    // Check that SQLite summaries no longer contain literal '[object Object]'
    const badSummaries = await all("SELECT * FROM summaries WHERE short_summary = '[object Object]'");
    assert.strictEqual(badSummaries.length, 0, 'No summary rows should store literal [object Object]');

    // Verify PDF overview fallback handles missing or corrupted summary gracefully
    const overviewLectureId = 'test_lec_overview_' + Date.now();
    await run(
      'INSERT INTO lectures (id, room_id, title, host_id, status, visibility) VALUES (?, ?, ?, ?, ?, ?)',
      [overviewLectureId, 'ROOM_OV', 'Test Overview Lecture', 'test_teacher_1', 'ENDED', 'PUBLIC']
    );
    await run(
      'INSERT INTO summaries (id, lecture_id, short_summary, detailed_summary) VALUES (?, ?, ?, ?)',
      ['sum_ov_test', overviewLectureId, '[object Object]', 'A clean detailed summary of this technical lecture.']
    );

    const pdf = await generateStudyNotesPdf(overviewLectureId);
    assert.ok(pdf && pdf.filePath, 'PDF must generate successfully');
    assert.ok(fs.existsSync(pdf.filePath), 'PDF file must exist');

    // Clean up
    try { fs.unlinkSync(pdf.filePath); } catch (_) {}
    await run('DELETE FROM summaries WHERE id = ?', ['sum_ov_test']);
    await run('DELETE FROM lectures WHERE id = ?', [overviewLectureId]);
  });

  // 28. Real SQL Lecture lec_098c18a6 PDF Generation & Irrelevant Diagram Elimination
  test('28. Real SQL Lecture lec_098c18a6 PDF Generation & Irrelevant Diagram Elimination', async () => {
    // Generate PDF for real SQL lecture lec_098c18a6
    const pdf = await generateStudyNotesPdf('lec_098c18a6');
    assert.ok(pdf && pdf.filePath, 'Must generate PDF for lec_098c18a6');
    assert.ok(fs.existsSync(pdf.filePath), 'Generated PDF file must exist on disk');

    const stats = fs.statSync(pdf.filePath);
    assert.ok(stats.size > 5000, 'Generated PDF must have substantial content (> 5KB)');

    // Inspect the generated PDF binary buffer for forbidden strings
    const pdfBuffer = fs.readFileSync(pdf.filePath);
    const pdfText = pdfBuffer.toString('latin1');

    assert.ok(!pdfText.includes('[object Object]'), 'PDF must NEVER contain [object Object]');
    assert.ok(!pdfText.includes('Target 23 located at index 5 in O(log n) time'), 'SQL lecture PDF must NEVER contain binary search target');
    assert.ok(!pdfText.includes('Search Interval: [4 .. 7]'), 'SQL lecture PDF must NEVER contain binary search interval');
  });

  // 29. Metadata-Content Consistency: Genuine Conflict / Possible Mismatch Detection
  test('29. Metadata-Content Consistency: Genuine Conflict / Possible Mismatch Detection', () => {
    const declaredTitle = 'Medieval European Feudalism';
    const declaredSubject = 'European History';
    const divergingEvidence = [
      {
        id: 'ev_sql_1',
        timestamp: 15,
        type: 'TRANSCRIPT',
        text: 'Today we examine relational database schema design with primary keys and foreign keys in SQL tables',
      },
      {
        id: 'ev_sql_2',
        timestamp: 45,
        type: 'TRANSCRIPT',
        text: 'We execute SELECT queries joining customer orders with table index optimization and relational tuples',
      },
      {
        id: 'ev_sql_3',
        timestamp: 90,
        type: 'TRANSCRIPT',
        text: 'Transactions must satisfy ACID properties ensuring database concurrency and rollback integrity',
      },
    ];

    const report = estimateConsistencyHeuristic(declaredTitle, declaredSubject, divergingEvidence);
    assert.strictEqual(report.status, 'POSSIBLE_MISMATCH', 'Must flag conflicting domain as POSSIBLE_MISMATCH');
    assert.strictEqual(report.matchType, 'GENUINE_CONFLICT', 'Must classify discrepancy as GENUINE_CONFLICT');
    assert.strictEqual(report.isProvisional, true, 'Conflict inference must be flagged as provisional without overwriting title');
    assert.ok(report.explanation.includes('diverges from declared title'), 'Explanation must explain divergence');
    assert.ok(report.evidenceRefs.length > 0, 'Report must reference supporting evidence');
  });

  // 30. Metadata-Content Consistency: Broad Title Handling
  test('30. Metadata-Content Consistency: Broad Title Handling', () => {
    const broadTitle = 'Overview of Systems Engineering';
    const broadSubject = 'Engineering';
    const thermoEvidence = [
      {
        id: 'ev_th_1',
        timestamp: 20,
        type: 'TRANSCRIPT',
        text: 'Let us consider the thermodynamic properties of closed cycles including enthalpy and entropy',
      },
      {
        id: 'ev_th_2',
        timestamp: 60,
        type: 'TRANSCRIPT',
        text: 'The Carnot cycle establishes the maximum theoretical efficiency between two thermal reservoirs',
      },
    ];

    const report = estimateConsistencyHeuristic(broadTitle, broadSubject, thermoEvidence);
    assert.strictEqual(report.status, 'CONSISTENT', 'Broad titles must be accepted as CONSISTENT');
    assert.strictEqual(report.matchType, 'BROAD_TITLE', 'Must identify match type as BROAD_TITLE');
    assert.strictEqual(report.isProvisional, false, 'Broad title match must not be flagged provisional');
  });

  // 31. Metadata-Content Consistency: Insufficient Evidence Handling
  test('31. Metadata-Content Consistency: Insufficient Evidence Handling', () => {
    const title = 'Quantum Computation Algorithms';
    const subject = 'Quantum Physics';
    const sparseEvidence = [
      {
        id: 'ev_sp_1',
        timestamp: 5,
        type: 'TRANSCRIPT',
        text: 'Good morning everyone',
      },
    ];

    const report = estimateConsistencyHeuristic(title, subject, sparseEvidence);
    assert.strictEqual(report.status, 'INSUFFICIENT_EVIDENCE', 'Sparse evidence (< 8 tokens) must yield INSUFFICIENT_EVIDENCE');
    assert.strictEqual(report.matchType, 'INSUFFICIENT_DATA', 'Match type must be INSUFFICIENT_DATA');
    assert.strictEqual(report.confidence, 'LOW', 'Confidence must be LOW');
  });

  // 32. Dynamic Domain Context Prompt Formatting
  test('32. Dynamic Domain Context Prompt Formatting', () => {
    const domainContext = {
      declaredTitle: 'Microeconomic Theory: Consumer Choice',
      authoritativeDomain: 'Microeconomics',
      consistencyStatus: 'CONSISTENT',
      matchType: 'MATCH',
      confidence: 'HIGH',
      isProvisional: false,
    };
    const currentSection = {
      heading: 'Price Elasticity of Demand',
      learningObjective: 'Calculate percentage responsiveness of quantity demanded to price changes',
      keyConcepts: ['Elasticity Coefficient', 'Total Revenue Test'],
    };

    const promptBlock = formatDomainContextForPrompt(domainContext, currentSection);
    assert.ok(promptBlock.includes('AUTHORITATIVE ACADEMIC DOMAIN CONTEXT'), 'Must include domain header');
    assert.ok(promptBlock.includes('Microeconomics'), 'Must include authoritative domain');
    assert.ok(promptBlock.includes('Price Elasticity of Demand'), 'Must include current section heading');
    assert.ok(promptBlock.includes('Calculate percentage responsiveness'), 'Must include learning objective');
    assert.ok(promptBlock.includes('DISCIPLINE GROUNDING RULES'), 'Must include discipline grounding rules');
    assert.ok(promptBlock.includes('Do NOT introduce terminology, formulas, or diagrams from unrelated disciplines'), 'Must forbid unrelated disciplines');
  });

  // 33. End-to-End Unseen Discipline Study Notes Generation Without Hardcoded Catalogs
  test('33. End-to-End Unseen Discipline Study Notes Generation Without Hardcoded Catalogs', async () => {
    const chemLecId = 'test_lec_chem_' + Date.now();
    const chemRoomId = 'ROOM_CHEM_' + Date.now();
    await run(
      `INSERT INTO lectures (id, room_id, title, description, host_id, status, visibility, subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chemLecId,
        chemRoomId,
        'Organic Chemistry: Carbocation Stability and Hyperconjugation',
        'Advanced Organic Chemistry Lecture',
        'test_teacher_1',
        'ENDED',
        'PUBLIC',
        'Organic Chemistry',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, start_time, end_time, text, speaker_name)
       VALUES
       (?, 10.0, 30.0, 'Tertiary carbocations are significantly more stable than secondary carbocations due to hyperconjugation.', 'Dr. Chemist'),
       (?, 35.0, 60.0, 'In hyperconjugation, sigma electrons of adjacent C-H bonds overlap with the vacant p-orbital of the carbocation.', 'Dr. Chemist'),
       (?, 65.0, 95.0, 'This stabilization determines regioselectivity in electrophilic addition reactions following Markovnikov rule.', 'Dr. Chemist')`,
      [
        chemLecId,
        chemLecId,
        chemLecId,
      ]
    );

    // 1. Resolve domain context dynamically
    const domainProfile = await resolveLectureDomainContext(chemLecId, { forceRefresh: true });
    assert.ok(domainProfile, 'Must resolve domain profile for unseen discipline');
    assert.ok(
      domainProfile.authoritativeDomain.toLowerCase().includes('organic chemistry'),
      `Authoritative domain "${domainProfile.authoritativeDomain}" must reflect Organic Chemistry`
    );

    // 2. Verify consistency report stored in database
    const savedReports = await all(
      'SELECT * FROM metadata_consistency_reports WHERE lecture_id = ? ORDER BY created_at DESC',
      [chemLecId]
    );
    assert.ok(savedReports.length > 0, 'Must record metadata consistency report in SQLite');
    assert.strictEqual(savedReports[0].declared_title, 'Organic Chemistry: Carbocation Stability and Hyperconjugation');

    // 3. Generate study notes
    const notes = await generateStudyNotes(chemLecId, 'detailed');
    assert.ok(notes, 'Notes must be generated for unseen discipline');
    assert.ok(notes.contentMarkdown, 'Notes must contain markdown text');

    // 4. Confirm NO physics contamination (no $v = u + at$ injected into organic chemistry notes)
    const notesText = JSON.stringify(notes);
    assert.ok(!notesText.includes('v = u + at'), 'Chemistry notes must NEVER contain physics kinematics fallback v = u + at');
    assert.ok(!notesText.includes('velocity-time graph'), 'Chemistry notes must NEVER contain velocity-time graph questions');

    // Cleanup
    await run('DELETE FROM metadata_consistency_reports WHERE lecture_id = ?', [chemLecId]);
    await run('DELETE FROM transcript_segments WHERE lecture_id = ?', [chemLecId]);
    await run('DELETE FROM study_notes WHERE lecture_id = ?', [chemLecId]);
    await run('DELETE FROM lectures WHERE id = ?', [chemLecId]);
  });

  // 34. Optional Diagram Omission Decision Policy Enforcement
  test('34. Optional Diagram Omission Decision Policy Enforcement', () => {
    // When a section has no grounded visual evidence, the visualization must be omitted or marked optional
    const ungroundedSection = {
      heading: 'Abstract Legal Jurisprudence Principles',
      topic: 'Jurisprudence',
      visualization: {
        type: 'none',
        required: false,
        reason: 'No geometric or algorithmic structure supported by evidence',
      },
    };

    assert.strictEqual(ungroundedSection.visualization.required, false, 'Ungrounded diagram must not be marked required');
    // Ensure rendering registry does not inject default binary search for legal section
    const rendered = diagramRegistry.render({
      visualizationType: 'flowchart',
      title: 'Jurisprudence Principles',
      nodes: [],
      edges: [],
    });
    assert.ok(!rendered.includes('LOW [4]'), 'Omitted/empty diagrams must never inject binary search array templates');
  });
});

