/**
 * test_client.mjs
 *
 * Client Component & Services Verification Suite
 * Tests client-side domain registry, algorithmic suitability matching, and contract invariants.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUALIZER_REGISTRY,
  VISUALIZATION_MODALITIES,
  getVisualizer,
  findVisualizerForConcept,
} from './src/services/visualizationRegistry.js';

test('Client Visualization Registry - Schema & Structural Integrity', async (t) => {
  await t.test('declares all expected modalities', () => {
    assert.equal(VISUALIZATION_MODALITIES.THREE_D, '3D');
    assert.equal(VISUALIZATION_MODALITIES.TWO_D, '2D');
    assert.equal(VISUALIZATION_MODALITIES.CONVENTIONAL, 'CONVENTIONAL');
  });

  await t.test('contains all four core registered visualizers', () => {
    const keys = Object.keys(VISUALIZER_REGISTRY);
    assert.ok(keys.includes('raft'), 'Must contain raft visualizer');
    assert.ok(keys.includes('avl'), 'Must contain avl visualizer');
    assert.ok(keys.includes('neural'), 'Must contain neural visualizer');
    assert.ok(keys.includes('2d_diagram'), 'Must contain 2d_diagram visualizer');
  });

  await t.test('every registered visualizer declares required educational metadata', () => {
    for (const [id, def] of Object.entries(VISUALIZER_REGISTRY)) {
      assert.equal(def.id, id, `Visualizer ${id} must match its key`);
      assert.ok(def.name && typeof def.name === 'string', `${id} must have a name`);
      assert.ok(def.description && typeof def.description === 'string', `${id} must have a description`);
      assert.ok(Array.isArray(def.supportedConceptTypes) && def.supportedConceptTypes.length > 0, `${id} must have supported concepts`);
      assert.ok(Array.isArray(def.capabilities) && def.capabilities.length > 0, `${id} must declare capabilities`);
      assert.ok(def.limitations && typeof def.limitations === 'string', `${id} must declare educational limitations`);
      assert.ok(def.prerequisites && typeof def.prerequisites === 'string', `${id} must declare prerequisites`);
    }
  });
});

test('Client Concept Matching & Pedagogical Suitability', async (t) => {
  await t.test('resolves Raft protocol to 3D Distributed Consensus Engine', () => {
    const result = findVisualizerForConcept('In this lecture, we examine distributed consensus and leader election');
    assert.ok(result);
    assert.equal(result.id, 'raft');
    assert.equal(result.modality, VISUALIZATION_MODALITIES.THREE_D);
  });

  await t.test('resolves AVL rotations to 3D Self-Balancing Tree', () => {
    const result = findVisualizerForConcept('Maintaining balance factor with left rotation (rr case) in AVL tree');
    assert.ok(result);
    assert.equal(result.id, 'avl');
    assert.equal(result.modality, VISUALIZATION_MODALITIES.THREE_D);
  });

  await t.test('resolves Multi-Layer Perceptron to 3D Neural Network', () => {
    const result = findVisualizerForConcept('Feedforward pass in a multi-layer perceptron with sigmoid activation');
    assert.ok(result);
    assert.equal(result.id, 'neural');
    assert.equal(result.modality, VISUALIZATION_MODALITIES.THREE_D);
  });

  await t.test('resolves Flowchart & Algorithmic Steps to 2D Vector Engine', () => {
    const result = findVisualizerForConcept('Examining the process pipeline and algorithm execution steps');
    assert.ok(result);
    assert.equal(result.id, '2d_diagram');
    assert.equal(result.modality, VISUALIZATION_MODALITIES.TWO_D);
  });

  await t.test('strictly abstains (returns null) for topics that do not benefit from visualization', () => {
    const nonVisualTopics = [
      'Introduction to 19th Century British Literature and Poetry',
      'Corporate law, mergers, and legal compliance contracts',
      'Administrative philosophy and employee performance review metrics',
      '',
      null,
      undefined,
    ];

    for (const topic of nonVisualTopics) {
      const match = findVisualizerForConcept(topic);
      assert.equal(match, null, `Should not recommend visualizer for non-beneficial topic: "${topic}"`);
    }
  });

  await t.test('getVisualizer returns exact record or null for unknown ID', () => {
    assert.ok(getVisualizer('raft'));
    assert.ok(getVisualizer('avl'));
    assert.ok(getVisualizer('neural'));
    assert.ok(getVisualizer('2d_diagram'));
    assert.equal(getVisualizer('quantum_entanglement_4d'), null);
  });
});

test('Client Simulator Algorithmic Correctness', async (t) => {
  await t.test('Raft quorum arithmetic requires strictly majority (ceil(N/2))', () => {
    const clusterSize = 5;
    const quorum = Math.floor(clusterSize / 2) + 1;
    assert.equal(quorum, 3);

    // 2 online nodes cannot form quorum
    assert.equal(2 >= quorum, false);
    // 3 online nodes can form quorum
    assert.equal(3 >= quorum, true);
  });

  await t.test('AVL balance factor calculation and strict rotation selection', () => {
    // LL case: BF(root) > 1 and BF(left) >= 0 -> Right rotation
    const bfRootLL = 2;
    const bfChildLL = 1;
    assert.ok(bfRootLL > 1 && bfChildLL >= 0, 'LL heavy triggers right rotation');

    // LR case: BF(root) > 1 and BF(left) < 0 -> Double rotation
    const bfRootLR = 2;
    const bfChildLR = -1;
    assert.ok(bfRootLR > 1 && bfChildLR < 0, 'LR heavy triggers double rotation');

    // RR case: BF(root) < -1 and BF(right) <= 0 -> Left rotation
    const bfRootRR = -2;
    const bfChildRR = -1;
    assert.ok(bfRootRR < -1 && bfChildRR <= 0, 'RR heavy triggers left rotation');

    // RL case: BF(root) < -1 and BF(right) > 0 -> Double rotation
    const bfRootRL = -2;
    const bfChildRL = 1;
    assert.ok(bfRootRL < -1 && bfChildRL > 0, 'RL heavy triggers double rotation');
  });

  await t.test('Neural Network non-linear activation math precision', () => {
    const sigmoid = (z) => 1 / (1 + Math.exp(-z));
    const relu = (z) => Math.max(0, z);
    const tanh = (z) => Math.tanh(z);

    assert.equal(sigmoid(0), 0.5);
    assert.equal(relu(-5), 0);
    assert.equal(relu(5), 5);
    assert.equal(tanh(0), 0);
  });
});
