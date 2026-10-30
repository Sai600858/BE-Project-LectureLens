/**
 * simulator_algorithms.test.js
 *
 * Independent algorithmic verification for LectureLens simulators:
 * 1. Raft Distributed Consensus Model (Quorum arithmetic, elections, log replication, partition handling)
 * 2. AVL Self-Balancing Binary Search Tree (Rotations LL/RR/LR/RL, height, balance factor, BST invariant)
 * 3. Neural Network MLP (Matrix operations, weighted sums, Sigmoid/ReLU/Tanh, Softmax distribution)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// ── 1. RAFT CONSENSUS ALGORITHM MODEL ──────────────────────────────────────────
class RaftClusterModel {
  constructor(nodeCount = 5) {
    this.nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: i + 1,
      role: i === 0 ? 'LEADER' : 'FOLLOWER',
      term: 1,
      votedFor: i === 0 ? 1 : null,
      log: ['SET x=1', 'SET y=2', 'SET z=3'],
      online: true,
    }));
    this.term = 1;
  }

  get onlineNodes() {
    return this.nodes.filter((n) => n.online);
  }

  get quorum() {
    return Math.floor(this.nodes.length / 2) + 1; // 3 for 5 nodes
  }

  get leader() {
    return this.nodes.find((n) => n.role === 'LEADER' && n.online) || null;
  }

  toggleNode(id) {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;
    node.online = !node.online;
    if (!node.online) {
      node.role = 'OFFLINE';
    } else {
      node.role = 'FOLLOWER';
      // If active leader exists, synchronize term
      if (this.leader) {
        node.term = this.leader.term;
        node.votedFor = null;
      }
    }
  }

  triggerElection(candidateId) {
    const candidate = this.nodes.find((n) => n.id === candidateId && n.online);
    if (!candidate) return { success: false, reason: 'Candidate not online' };

    if (this.onlineNodes.length < this.quorum) {
      return { success: false, reason: 'Quorum impossible', votesGranted: 0 };
    }

    const nextTerm = this.term + 1;
    this.term = nextTerm;
    candidate.term = nextTerm;
    candidate.role = 'CANDIDATE';
    candidate.votedFor = candidate.id;

    // Follower voting logic
    let votes = 1; // Self vote
    for (const follower of this.onlineNodes) {
      if (follower.id === candidate.id) continue;
      // Follower grants vote if its term <= candidate term and hasn't voted
      if (follower.term <= nextTerm && (follower.votedFor === null || follower.votedFor === candidate.id)) {
        follower.term = nextTerm;
        follower.votedFor = candidate.id;
        follower.role = 'FOLLOWER';
        votes++;
      }
    }

    if (votes >= this.quorum) {
      // Won election
      candidate.role = 'LEADER';
      // Step down any other leaders
      this.nodes.forEach((n) => {
        if (n.id !== candidate.id && n.online) {
          n.role = 'FOLLOWER';
          n.term = nextTerm;
        }
      });
      return { success: true, term: nextTerm, leaderId: candidate.id, votesGranted: votes };
    } else {
      // Split vote or failed election
      candidate.role = 'FOLLOWER';
      return { success: false, reason: 'Split vote / insufficient votes', votesGranted: votes };
    }
  }

  proposeLogEntry(entry) {
    const leader = this.leader;
    if (!leader) return { success: false, reason: 'No active leader' };

    const onlineFollowers = this.nodes.filter((n) => n.online && n.id !== leader.id);
    const replicatedNodes = [leader.id, ...onlineFollowers.map((f) => f.id)];

    if (replicatedNodes.length >= this.quorum) {
      // Committed
      this.nodes.forEach((n) => {
        if (n.online) n.log.push(entry);
      });
      return { success: true, committed: true, acks: replicatedNodes.length };
    } else {
      // Not committed
      leader.log.push(`UNCOMMITTED:${entry}`);
      return { success: false, committed: false, acks: replicatedNodes.length };
    }
  }
}

// ── 2. AVL TREE ALGORITHM MODEL ───────────────────────────────────────────────
class AVLNode {
  constructor(key) {
    this.key = key;
    this.height = 1;
    this.left = null;
    this.right = null;
  }
}

function getHeight(node) {
  return node ? node.height : 0;
}

function getBalance(node) {
  return node ? getHeight(node.left) - getHeight(node.right) : 0;
}

function rightRotate(y) {
  const x = y.left;
  const T2 = x.right;
  x.right = y;
  y.left = T2;
  y.height = Math.max(getHeight(y.left), getHeight(y.right)) + 1;
  x.height = Math.max(getHeight(x.left), getHeight(x.right)) + 1;
  return x;
}

function leftRotate(x) {
  const y = x.right;
  const T2 = y.left;
  y.left = x;
  x.right = T2;
  x.height = Math.max(getHeight(x.left), getHeight(x.right)) + 1;
  y.height = Math.max(getHeight(y.left), getHeight(y.right)) + 1;
  return y;
}

function insertNode(node, key, autoBalance = true, rotationLogs = []) {
  if (!node) return new AVLNode(key);

  if (key < node.key) {
    node.left = insertNode(node.left, key, autoBalance, rotationLogs);
  } else if (key > node.key) {
    node.right = insertNode(node.right, key, autoBalance, rotationLogs);
  } else {
    // Duplicate keys rejected
    return node;
  }

  node.height = 1 + Math.max(getHeight(node.left), getHeight(node.right));

  if (!autoBalance) return node;

  const balance = getBalance(node);

  // Left Heavy
  if (balance > 1) {
    if (getBalance(node.left) >= 0) {
      rotationLogs.push(`LL_ROTATION:${node.key}`);
      return rightRotate(node);
    } else {
      rotationLogs.push(`LR_ROTATION:${node.key}`);
      node.left = leftRotate(node.left);
      return rightRotate(node);
    }
  }

  // Right Heavy
  if (balance < -1) {
    if (getBalance(node.right) <= 0) {
      rotationLogs.push(`RR_ROTATION:${node.key}`);
      return leftRotate(node);
    } else {
      rotationLogs.push(`RL_ROTATION:${node.key}`);
      node.right = rightRotate(node.right);
      return leftRotate(node);
    }
  }

  return node;
}

function isBstValid(node, min = -Infinity, max = Infinity) {
  if (!node) return true;
  if (node.key <= min || node.key >= max) return false;
  return isBstValid(node.left, min, node.key) && isBstValid(node.right, node.key, max);
}

function isAvlBalanced(node) {
  if (!node) return true;
  const bf = getBalance(node);
  if (Math.abs(bf) > 1) return false;
  return isAvlBalanced(node.left) && isAvlBalanced(node.right);
}

// ── 3. NEURAL NETWORK MATHEMATICAL COMPUTATIONS ──────────────────────────────
function activate(val, type) {
  if (type === 'relu') return Math.max(0, val);
  if (type === 'tanh') return Math.tanh(val);
  // Default Sigmoid with overflow clamping
  const clamped = Math.max(-15, Math.min(15, val));
  return 1 / (1 + Math.exp(-clamped));
}

function forwardPass(inputs, weights, activationFn = 'sigmoid') {
  const { w1, b1, w2, b2 } = weights;

  // Layer 1: Hidden z = W1^T * x + b1
  const hiddenZ = [0, 1, 2].map((j) => {
    return inputs[0] * w1[0][j] + inputs[1] * w1[1][j] + b1[j];
  });
  const hiddenA = hiddenZ.map((z) => activate(z, activationFn));

  // Layer 2: Output z = W2^T * a + b2
  const outputZ = [0, 1].map((k) => {
    return hiddenA[0] * w2[0][k] + hiddenA[1] * w2[1][k] + hiddenA[2] * w2[2][k] + b2[k];
  });
  const outputA = outputZ.map((z) => activate(z, activationFn));

  // Softmax
  const maxZ = Math.max(...outputZ);
  const expZ = outputZ.map((z) => Math.exp(z - maxZ));
  const sumExp = expZ.reduce((a, b) => a + b, 0);
  const softmax = expZ.map((e) => (sumExp === 0 ? 0.5 : e / sumExp));

  return { hiddenZ, hiddenA, outputZ, outputA, softmax };
}

// ── TEST SUITE ────────────────────────────────────────────────────────────────
describe('Simulator Algorithm & Mathematical Verification Suite', () => {
  // ── RAFT TESTS ──────────────────────────────────────────────────────────────
  describe('Raft Consensus Algorithm', () => {
    test('Initial cluster state has 5 nodes and quorum of 3', () => {
      const cluster = new RaftClusterModel(5);
      assert.strictEqual(cluster.nodes.length, 5);
      assert.strictEqual(cluster.quorum, 3);
      assert.strictEqual(cluster.leader.id, 1);
      assert.strictEqual(cluster.term, 1);
    });

    test('Triggering leader election with full cluster elects candidate with majority', () => {
      const cluster = new RaftClusterModel(5);
      const res = cluster.triggerElection(2);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.term, 2);
      assert.strictEqual(cluster.leader.id, 2);
      assert.strictEqual(cluster.leader.role, 'LEADER');
      assert.strictEqual(cluster.nodes.find((n) => n.id === 1).role, 'FOLLOWER');
    });

    test('Quorum failure when fewer than 3 nodes are online', () => {
      const cluster = new RaftClusterModel(5);
      cluster.toggleNode(3); // Node 3 offline
      cluster.toggleNode(4); // Node 4 offline
      cluster.toggleNode(5); // Node 5 offline (only 1 & 2 online)
      assert.strictEqual(cluster.onlineNodes.length, 2);

      const res = cluster.triggerElection(2);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'Quorum impossible');
    });

    test('Log proposal committed only when replicated to majority (>= 3 nodes)', () => {
      const cluster = new RaftClusterModel(5);
      // All 5 online -> committed
      const res1 = cluster.proposeLogEntry('SET alpha=100');
      assert.strictEqual(res1.committed, true);
      assert.strictEqual(res1.acks, 5);

      // Crash 3 nodes (only 2 remain online)
      cluster.toggleNode(3);
      cluster.toggleNode(4);
      cluster.toggleNode(5);
      const res2 = cluster.proposeLogEntry('SET beta=200');
      assert.strictEqual(res2.committed, false);
      assert.strictEqual(res2.acks, 2);
    });

    test('Crashing leader drops leader reference; recovering restores follower', () => {
      const cluster = new RaftClusterModel(5);
      cluster.toggleNode(1); // Crash Leader
      assert.strictEqual(cluster.leader, null);
      assert.strictEqual(cluster.nodes.find((n) => n.id === 1).role, 'OFFLINE');

      cluster.toggleNode(1); // Revive
      assert.strictEqual(cluster.nodes.find((n) => n.id === 1).role, 'FOLLOWER');
    });
  });

  // ── AVL TREE TESTS ──────────────────────────────────────────────────────────
  describe('AVL Tree Algorithm & Rotations', () => {
    test('LL Rotation: Inserting decreasing sequence [30, 20, 10] triggers Right Rotation', () => {
      const logs = [];
      let root = null;
      root = insertNode(root, 30, true, logs);
      root = insertNode(root, 20, true, logs);
      root = insertNode(root, 10, true, logs);

      assert.ok(logs.some((l) => l.startsWith('LL_ROTATION:30')), 'Should perform LL rotation on 30');
      assert.strictEqual(root.key, 20, '20 should be new root');
      assert.strictEqual(root.left.key, 10);
      assert.strictEqual(root.right.key, 30);
      assert.ok(isBstValid(root));
      assert.ok(isAvlBalanced(root));
    });

    test('RR Rotation: Inserting increasing sequence [10, 20, 30] triggers Left Rotation', () => {
      const logs = [];
      let root = null;
      root = insertNode(root, 10, true, logs);
      root = insertNode(root, 20, true, logs);
      root = insertNode(root, 30, true, logs);

      assert.ok(logs.some((l) => l.startsWith('RR_ROTATION:10')), 'Should perform RR rotation on 10');
      assert.strictEqual(root.key, 20, '20 should be new root');
      assert.strictEqual(root.left.key, 10);
      assert.strictEqual(root.right.key, 30);
      assert.ok(isBstValid(root));
      assert.ok(isAvlBalanced(root));
    });

    test('LR Rotation: Inserting [30, 10, 20] triggers Left-Right Double Rotation', () => {
      const logs = [];
      let root = null;
      root = insertNode(root, 30, true, logs);
      root = insertNode(root, 10, true, logs);
      root = insertNode(root, 20, true, logs);

      assert.ok(logs.some((l) => l.startsWith('LR_ROTATION:30')), 'Should perform LR rotation on 30');
      assert.strictEqual(root.key, 20);
      assert.strictEqual(root.left.key, 10);
      assert.strictEqual(root.right.key, 30);
      assert.ok(isBstValid(root));
      assert.ok(isAvlBalanced(root));
    });

    test('RL Rotation: Inserting [10, 30, 20] triggers Right-Left Double Rotation', () => {
      const logs = [];
      let root = null;
      root = insertNode(root, 10, true, logs);
      root = insertNode(root, 30, true, logs);
      root = insertNode(root, 20, true, logs);

      assert.ok(logs.some((l) => l.startsWith('RL_ROTATION:10')), 'Should perform RL rotation on 10');
      assert.strictEqual(root.key, 20);
      assert.strictEqual(root.left.key, 10);
      assert.strictEqual(root.right.key, 30);
      assert.ok(isBstValid(root));
      assert.ok(isAvlBalanced(root));
    });

    test('Duplicate keys are rejected without altering tree height or balance', () => {
      let root = null;
      root = insertNode(root, 50, true);
      root = insertNode(root, 25, true);
      const h1 = getHeight(root);

      root = insertNode(root, 25, true); // Duplicate insertion
      assert.strictEqual(getHeight(root), h1, 'Height must remain identical');
      assert.strictEqual(root.left.key, 25);
      assert.strictEqual(root.left.left, null);
      assert.strictEqual(root.left.right, null);
    });

    test('Sequential multi-insertion of 10 keys satisfies BST ordering and AVL balance at every step', () => {
      const keys = [50, 25, 75, 10, 30, 60, 90, 5, 15, 27];
      let root = null;

      for (const k of keys) {
        root = insertNode(root, k, true);
        assert.ok(isBstValid(root), `Tree must satisfy BST order after inserting ${k}`);
        assert.ok(isAvlBalanced(root), `Tree must satisfy AVL balance after inserting ${k}`);
      }

      assert.ok(getHeight(root) <= 4, 'Height of 10-node AVL tree must be <= 4');
    });
  });

  // ── NEURAL NETWORK TESTS ────────────────────────────────────────────────────
  describe('Neural Network Forward Pass & Matrix Computations', () => {
    const weights = {
      w1: [
        [1.0, -1.0, 0.5],
        [-0.5, 1.5, -0.5],
      ],
      b1: [0.1, -0.1, 0.0],
      w2: [
        [1.0, -1.0],
        [-1.0, 1.0],
        [0.5, -0.5],
      ],
      b2: [0.0, 0.0],
    };

    test('Sigmoid activation calculation within bounds', () => {
      assert.strictEqual(activate(0, 'sigmoid'), 0.5);
      assert.ok(activate(10, 'sigmoid') > 0.999);
      assert.ok(activate(-10, 'sigmoid') < 0.001);
    });

    test('ReLU activation returns max(0, z)', () => {
      assert.strictEqual(activate(2.5, 'relu'), 2.5);
      assert.strictEqual(activate(-3.5, 'relu'), 0);
      assert.strictEqual(activate(0, 'relu'), 0);
    });

    test('Tanh activation returns tanh(z)', () => {
      assert.strictEqual(activate(0, 'tanh'), 0);
      assert.ok(Math.abs(activate(1, 'tanh') - 0.76159) < 0.001);
    });

    test('Forward pass computes exact linear combinations and activations', () => {
      const inputs = [1.0, 2.0];
      const res = forwardPass(inputs, weights, 'sigmoid');

      // Expected hidden z:
      // z1 = 1.0*1.0 + 2.0*(-0.5) + 0.1 = 1.0 - 1.0 + 0.1 = 0.1
      // z2 = 1.0*(-1.0) + 2.0*(1.5) - 0.1 = -1.0 + 3.0 - 0.1 = 1.9
      // z3 = 1.0*(0.5) + 2.0*(-0.5) + 0.0 = 0.5 - 1.0 + 0.0 = -0.5
      assert.ok(Math.abs(res.hiddenZ[0] - 0.1) < 1e-6);
      assert.ok(Math.abs(res.hiddenZ[1] - 1.9) < 1e-6);
      assert.ok(Math.abs(res.hiddenZ[2] - (-0.5)) < 1e-6);

      // Softmax sums to exactly 1.0
      const sumProb = res.softmax[0] + res.softmax[1];
      assert.ok(Math.abs(sumProb - 1.0) < 1e-6, 'Softmax probabilities must sum to 1.0');
    });

    test('Extreme numerical inputs do not produce NaN or unhandled errors', () => {
      const inputs = [100.0, -100.0];
      const res = forwardPass(inputs, weights, 'sigmoid');
      assert.ok(!isNaN(res.outputA[0]));
      assert.ok(!isNaN(res.outputA[1]));
      assert.ok(!isNaN(res.softmax[0]));
      assert.ok(!isNaN(res.softmax[1]));
    });
  });
});
