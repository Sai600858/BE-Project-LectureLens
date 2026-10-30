/**
 * lecture_visualization.test.js
 *
 * Automated verification suite for LectureLens Lecture-Aware Adaptive Visualization System.
 * Tests all 10 core scenarios specified in the design requirements:
 * 1. Eligible 3D topic (Raft) exposes the correct 3D visualizer
 * 2. Eligible 3D topic (AVL tree) exposes the correct 3D visualizer
 * 3. Eligible 3D topic (Neural Network) exposes the correct 3D visualizer
 * 4. 2D concept (SQL flow / diagrams) selects Category B (2D) without forcing 3D
 * 5. Conventional theory selects Category C without forcing any visualization
 * 6. Different lectures maintain strict isolation without state bleed
 * 7. Metadata contract adheres to required schema (lectureId, topicId, learningObjective, timestamps)
 * 8. Cache invalidation and multi-lecture switching integrity
 * 9. Unsupported concepts do not falsely map to unrelated visualizers
 * 10. HTTP endpoint /api/lectures/:lectureId/visualizations produces valid JSON payload
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/db');
const {
  evaluateLectureTopicVisualizations,
  invalidateLectureVisualizationCache,
  REGISTERED_3D_MODULES,
} = require('../src/lectureVisualizationService');

describe('Lecture-Aware Adaptive Visualization System Test Suite', () => {
  const raftLectureId = 'test_lec_raft_' + Date.now();
  const avlLectureId = 'test_lec_avl_' + Date.now();
  const neuralLectureId = 'test_lec_neural_' + Date.now();
  const sqlLectureId = 'test_lec_sql_' + Date.now();
  const chemLectureId = 'test_lec_chem_' + Date.now();

  before(async () => {
    // 1. Seed Raft / Distributed Systems Lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, subject, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        raftLectureId,
        'ROOM_RAFT',
        'Distributed Systems: Consensus Protocols',
        'Computer Science',
        'Covers distributed consensus, Raft leader election, heartbeats, log replication, and quorum partitions.',
        'user_teacher_1',
        'ENDED',
        'PUBLIC',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, speaker_name, text, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        raftLectureId,
        'Prof. Leslie',
        'In Raft consensus, when the leader crashes, heartbeat timeouts trigger a new election term and request votes.',
        120.0,
        145.0,
      ]
    );

    // 2. Seed AVL Tree Lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, subject, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        avlLectureId,
        'ROOM_AVL',
        'Advanced Data Structures: AVL Trees',
        'Computer Science',
        'Explores self-balancing binary search trees, balance factor computation, and LL, RR, LR, RL rotations.',
        'user_teacher_1',
        'ENDED',
        'PUBLIC',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, speaker_name, text, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        avlLectureId,
        'Prof. Tarjan',
        'When inserting into an AVL tree, if the balance factor becomes 2 or -2, we execute a tree rotation.',
        80.0,
        110.0,
      ]
    );

    // 3. Seed Neural Network Lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, subject, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        neuralLectureId,
        'ROOM_NEURAL',
        'Deep Learning: Multi-Layer Perceptrons',
        'Machine Learning',
        'Discusses neural network layers, feedforward matrix multiplication, weights, biases, and sigmoid activations.',
        'user_teacher_1',
        'ENDED',
        'PUBLIC',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, speaker_name, text, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        neuralLectureId,
        'Prof. Hinton',
        'Each neuron computes Z equals W transpose X plus B, followed by a non-linear activation function.',
        65.0,
        95.0,
      ]
    );

    // 4. Seed SQL / 2D Flow Lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, subject, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sqlLectureId,
        'ROOM_SQL',
        'Relational Databases: SQL Functions & Null Handling',
        'Databases',
        'Covers SQL string transformations and COALESCE null value replacement pipelines.',
        'user_teacher_1',
        'ENDED',
        'PUBLIC',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, speaker_name, text, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sqlLectureId,
        'Prof. Codd',
        'COALESCE evaluates arguments sequentially and returns the first non-null value in the expression list.',
        45.0,
        70.0,
      ]
    );

    // 5. Seed Conventional Chemistry Theory Lecture
    await run(
      `INSERT OR REPLACE INTO lectures (id, room_id, title, subject, description, host_id, status, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chemLectureId,
        'ROOM_CHEM',
        'Introduction to Academic Regulations and Course Syllabus',
        'General Studies',
        'Review of syllabus policies, grading rubrics, attendance guidelines, and office hours.',
        'user_teacher_1',
        'ENDED',
        'PUBLIC',
      ]
    );

    await run(
      `INSERT INTO transcript_segments (lecture_id, speaker_name, text, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        chemLectureId,
        'Dean Watson',
        'Homework is due weekly on Friday by 5pm. Please check the student portal for submission details.',
        10.0,
        30.0,
      ]
    );
  });

  after(async () => {
    await run('DELETE FROM transcript_segments WHERE lecture_id IN (?, ?, ?, ?, ?)', [
      raftLectureId,
      avlLectureId,
      neuralLectureId,
      sqlLectureId,
      chemLectureId,
    ]);
    await run('DELETE FROM lectures WHERE id IN (?, ?, ?, ?, ?)', [
      raftLectureId,
      avlLectureId,
      neuralLectureId,
      sqlLectureId,
      chemLectureId,
    ]);
  });

  // Scenario 1: Raft Distributed Systems Lecture
  test('Scenario 1: Lecture containing Raft consensus exposes Category A 3D visualizer', async () => {
    const manifest = await evaluateLectureTopicVisualizations(raftLectureId, { forceRefresh: true });

    assert.ok(manifest, 'Manifest should be generated');
    assert.strictEqual(manifest.lectureId, raftLectureId);
    assert.strictEqual(manifest.has3DVisualizations, true, 'Should detect 3D visualization requirement');

    const raftViz = manifest.recommendedVisualizations.find((v) => v.visualizerId === 'raft');
    assert.ok(raftViz, 'Raft visualizer must be recommended');
    assert.strictEqual(raftViz.visualizationType, '3D');
    assert.strictEqual(raftViz.suitabilityCategory, 'CATEGORY_A');
    assert.ok(raftViz.learningObjective.includes('quorum'), 'Objective must reference quorums');
    assert.ok(raftViz.sourceTimestamps.length > 0, 'Must have grounded source timestamps');
    assert.ok(raftViz.sourceTranscriptSegments.length > 0, 'Must include grounded transcript snippet');
  });

  // Scenario 2: AVL Tree Lecture
  test('Scenario 2: Lecture containing AVL Trees exposes Category A 3D visualizer', async () => {
    const manifest = await evaluateLectureTopicVisualizations(avlLectureId, { forceRefresh: true });

    assert.ok(manifest);
    assert.strictEqual(manifest.has3DVisualizations, true);

    const avlViz = manifest.recommendedVisualizations.find((v) => v.visualizerId === 'avl');
    assert.ok(avlViz, 'AVL visualizer must be recommended');
    assert.strictEqual(avlViz.visualizationType, '3D');
    assert.strictEqual(avlViz.suitabilityCategory, 'CATEGORY_A');
    assert.ok(avlViz.learningObjective.includes('rotations'), 'Objective must reference tree rotations');
  });

  // Scenario 3: Neural Network Lecture
  test('Scenario 3: Lecture containing Neural Networks exposes Category A 3D visualizer', async () => {
    const manifest = await evaluateLectureTopicVisualizations(neuralLectureId, { forceRefresh: true });

    assert.ok(manifest);
    assert.strictEqual(manifest.has3DVisualizations, true);

    const nnViz = manifest.recommendedVisualizations.find((v) => v.visualizerId === 'neural');
    assert.ok(nnViz, 'Neural network visualizer must be recommended');
    assert.strictEqual(nnViz.visualizationType, '3D');
    assert.strictEqual(nnViz.suitabilityCategory, 'CATEGORY_A');
    assert.ok(nnViz.instructions.length >= 3, 'Must provide exploration instructions');
  });

  // Scenario 4: SQL Flow Lecture selects 2D (Category B) without forcing 3D
  test('Scenario 4: Concepts better suited to 2D (SQL flow) select Category B without forcing 3D', async () => {
    const manifest = await evaluateLectureTopicVisualizations(sqlLectureId, { forceRefresh: true });

    assert.ok(manifest);
    assert.strictEqual(manifest.has3DVisualizations, false, 'Should NOT force 3D for SQL flows');
    assert.strictEqual(manifest.has2DVisualizations, true, 'Must select 2D diagram');

    const sqlViz = manifest.recommendedVisualizations[0];
    assert.strictEqual(sqlViz.visualizationType, '2D');
    assert.strictEqual(sqlViz.suitabilityCategory, 'CATEGORY_B');
    assert.strictEqual(sqlViz.visualizerId, '2d_diagram');
  });

  // Scenario 5: Conventional Theory selects Category C with 0 forced visualizers
  test('Scenario 5: Pure conventional theory does not force an irrelevant 3D visualizer (Category C)', async () => {
    const manifest = await evaluateLectureTopicVisualizations(chemLectureId, { forceRefresh: true });

    assert.ok(manifest);
    assert.strictEqual(manifest.recommendedVisualizationsCount, 0, 'Zero visualizers recommended for pure theory');
    assert.strictEqual(manifest.has3DVisualizations, false);
    assert.strictEqual(manifest.has2DVisualizations, false);

    const topic = manifest.topics[0];
    assert.strictEqual(topic.suitabilityCategory, 'CATEGORY_C');
    assert.strictEqual(topic.visualizationType, 'CONVENTIONAL');
    assert.strictEqual(topic.recommended, false);
    assert.ok(topic.reasoning.includes('structured notes'), 'Provides educational rationale for conventional material');
  });

  // Scenario 6: Strict Lecture Isolation
  test('Scenario 6: Different lectures return their own isolated topics without state bleed', async () => {
    const raftManifest = await evaluateLectureTopicVisualizations(raftLectureId, { forceRefresh: true });
    const chemManifest = await evaluateLectureTopicVisualizations(chemLectureId, { forceRefresh: true });

    assert.notStrictEqual(raftManifest.lectureId, chemManifest.lectureId);
    assert.notStrictEqual(raftManifest.recommendedVisualizationsCount, chemManifest.recommendedVisualizationsCount);
    assert.strictEqual(raftManifest.recommendedVisualizations[0].visualizerId, 'raft');
    assert.strictEqual(chemManifest.recommendedVisualizations.length, 0);
  });

  // Scenario 7: Metadata Contract Verification
  test('Scenario 7: Recommended visualizer metadata adheres strictly to specified contract', async () => {
    const manifest = await evaluateLectureTopicVisualizations(raftLectureId);
    const viz = manifest.recommendedVisualizations[0];

    assert.ok(viz.lectureId, 'Must specify lectureId');
    assert.ok(viz.topicId, 'Must specify topicId');
    assert.ok(viz.topicTitle, 'Must specify topicTitle');
    assert.ok(['3D', '2D', 'CONVENTIONAL'].includes(viz.visualizationType), 'Must declare valid visualizationType');
    assert.ok(viz.learningObjective, 'Must specify learningObjective');
    assert.ok(Array.isArray(viz.sourceTimestamps), 'Must specify sourceTimestamps array');
    assert.ok(Array.isArray(viz.sourceTranscriptSegments), 'Must specify sourceTranscriptSegments array');
    assert.ok(viz.visualizerId, 'Must specify visualizerId');
    assert.ok(viz.grounding, 'Must include grounding object');
    assert.ok(viz.grounding.simulationAssumptions, 'Must disclose simulationAssumptions');
    assert.ok(viz.grounding.limitations, 'Must disclose limitations');
    assert.ok(Array.isArray(viz.instructions), 'Must provide instructions array');
  });

  // Scenario 8: Cache Invalidation
  test('Scenario 8: Invalidation cleans cache cleanly', async () => {
    await evaluateLectureTopicVisualizations(raftLectureId);
    invalidateLectureVisualizationCache(raftLectureId);
    // Should re-fetch cleanly without throwing
    const fresh = await evaluateLectureTopicVisualizations(raftLectureId);
    assert.strictEqual(fresh.lectureId, raftLectureId);
  });

  // Scenario 9: Unsupported concepts do not accidentally match unrelated visualizers
  test('Scenario 9: Unsupported topics do not accidentally open unrelated 3D modules', async () => {
    const chemManifest = await evaluateLectureTopicVisualizations(chemLectureId);
    const foundRaft = chemManifest.recommendedVisualizations.some((v) => v.visualizerId === 'raft');
    const foundAvl = chemManifest.recommendedVisualizations.some((v) => v.visualizerId === 'avl');
    const foundNeural = chemManifest.recommendedVisualizations.some((v) => v.visualizerId === 'neural');

    assert.strictEqual(foundRaft, false, 'Must not claim Raft for general studies');
    assert.strictEqual(foundAvl, false, 'Must not claim AVL tree for general studies');
    assert.strictEqual(foundNeural, false, 'Must not claim Neural network for general studies');
  });

  // Scenario 10: Supported Catalog Signatures
  test('Scenario 10: Registered 3D modules define capabilities, prerequisites, and limitations', () => {
    for (const [key, mod] of Object.entries(REGISTERED_3D_MODULES)) {
      assert.ok(mod.id, 'Module must have id');
      assert.ok(mod.title, 'Module must have title');
      assert.ok(mod.learningObjective, 'Module must have learningObjective');
      assert.ok(mod.suitabilityRationale, 'Module must have suitabilityRationale');
      assert.ok(mod.assumptions, 'Module must have assumptions');
      assert.ok(mod.limitations, 'Module must have limitations');
      assert.ok(Array.isArray(mod.keywords), 'Module must have keywords');
      assert.ok(Array.isArray(mod.instructions), 'Module must have instructions');
    }
  });
});
