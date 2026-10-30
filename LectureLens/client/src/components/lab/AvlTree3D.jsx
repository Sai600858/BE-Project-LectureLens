import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Badge from '../Badge';
import Button from '../Button';
import { isWebGLAvailable } from '../../utils/webglSupport';

// AVL Node Class
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

/**
 * Standard, mathematically rigorous AVL insertion algorithm
 * Checks child balance factors (not single key comparison) for canonical LL/RR/LR/RL rotation selection.
 */
function insertNode(node, key, autoBalance = true, rotationLogs = [], flags = { isDuplicate: false }) {
  if (!node) return new AVLNode(key);

  if (key < node.key) {
    node.left = insertNode(node.left, key, autoBalance, rotationLogs, flags);
  } else if (key > node.key) {
    node.right = insertNode(node.right, key, autoBalance, rotationLogs, flags);
  } else {
    flags.isDuplicate = true;
    return node; // Duplicate keys not inserted in strict BST
  }

  node.height = 1 + Math.max(getHeight(node.left), getHeight(node.right));

  if (!autoBalance) return node;

  const balance = getBalance(node);

  // Left Heavy
  if (balance > 1) {
    if (getBalance(node.left) >= 0) {
      // LL Case -> Single Right Rotation
      rotationLogs.push(`🔄 Right Rotation on Node ${node.key} (Left-Left heavy, BF=${balance})`);
      return rightRotate(node);
    } else {
      // LR Case -> Left Rotate Left Child, then Right Rotate Node
      rotationLogs.push(`🔄 Left-Right Double Rotation on Node ${node.key} (Left-Right heavy, BF=${balance})`);
      node.left = leftRotate(node.left);
      return rightRotate(node);
    }
  }

  // Right Heavy
  if (balance < -1) {
    if (getBalance(node.right) <= 0) {
      // RR Case -> Single Left Rotation
      rotationLogs.push(`🔄 Left Rotation on Node ${node.key} (Right-Right heavy, BF=${balance})`);
      return leftRotate(node);
    } else {
      // RL Case -> Right Rotate Right Child, then Left Rotate Node
      rotationLogs.push(`🔄 Right-Left Double Rotation on Node ${node.key} (Right-Left heavy, BF=${balance})`);
      node.right = rightRotate(node.right);
      return leftRotate(node);
    }
  }

  return node;
}

export default function AvlTree3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const objectsGroupRef = useRef(null);
  const timeoutsRef = useRef([]);

  const [root, setRoot] = useState(() => {
    let tree = new AVLNode(30);
    tree = insertNode(tree, 15, true);
    tree = insertNode(tree, 50, true);
    tree = insertNode(tree, 10, true);
    tree = insertNode(tree, 20, true);
    return tree;
  });

  const [inputVal, setInputVal] = useState('');
  const [autoBalance, setAutoBalance] = useState(true);
  const [highlightPath, setHighlightPath] = useState([]);
  const [actionMessage, setActionMessage] = useState('Interactive AVL tree initialized. Insert or search keys.');
  const [showTextAlt, setShowTextAlt] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Safe timeout
  const addTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // Text label sprite generator with texture reference
  const createNodeSprite = (text, sub = '') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    if (ctx.roundRect) ctx.roundRect(8, 8, 240, 112, 16);
    else ctx.rect(8, 8, 240, 112);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${text}`, 128, 52);

    if (sub) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(sub, 128, 92);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.6, 0.8, 1);
    sprite.userData = { texture };
    return sprite;
  };

  // Three.js Scene Setup
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglSupported(false);
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
    } catch (err) {
      console.warn('WebGL init failed:', err);
      setWebglSupported(false);
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060911);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);
    objectsGroupRef.current = objectsGroup;

    let rotAngle = 0;
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      rotAngle += 0.002;
      objectsGroup.rotation.y = Math.sin(rotAngle) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 450;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      ro.disconnect();
      timeoutsRef.current.forEach(clearTimeout);

      // Clean up meshes and textures
      if (objectsGroupRef.current) {
        objectsGroupRef.current.traverse((child) => {
          if (child.userData?.texture) child.userData.texture.dispose();
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      }

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Render 3D Tree Mesh Layout (With in-order spacing to prevent node collision)
  useEffect(() => {
    const group = objectsGroupRef.current;
    if (!group) return;

    // Dispose old tree children cleanly
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.userData?.texture) child.userData.texture.dispose();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    if (!root) return;

    // Step 1: In-order traversal to compute collision-free X coordinates
    let indexCounter = 0;
    const positions = new Map();
    const inOrderTraverse = (node, depth) => {
      if (!node) return;
      inOrderTraverse(node.left, depth + 1);
      positions.set(node.key, { xIndex: indexCounter++, depth });
      inOrderTraverse(node.right, depth + 1);
    };
    inOrderTraverse(root, 0);

    const totalNodes = positions.size;
    const horizSpacing = Math.max(1.8, Math.min(3.2, 14 / (totalNodes || 1)));
    const vertSpacing = 2.0;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Step 2: Build node spheres, labels, and connecting branches
    const renderNode3D = (node) => {
      if (!node) return;
      const posInfo = positions.get(node.key);
      const x = (posInfo.xIndex - (totalNodes - 1) / 2) * horizSpacing;
      const y = 3.0 - posInfo.depth * vertSpacing;
      const z = 0;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const isHighlighted = highlightPath.includes(node.key);
      const bf = getBalance(node);
      const isUnbalanced = Math.abs(bf) > 1;

      // Sphere
      const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
      const color = isHighlighted ? 0xf59e0b : isUnbalanced ? 0xef4444 : 0x3b82f6;
      const sphereMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isHighlighted ? 0.6 : 0.25,
        roughness: 0.3,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      group.add(sphere);

      // Label sprite
      const sprite = createNodeSprite(node.key, `H:${node.height} BF:${bf}`);
      sprite.position.set(x, y + 0.95, z);
      group.add(sprite);

      // Branch to Left child
      if (node.left) {
        const leftPos = positions.get(node.left.key);
        const lx = (leftPos.xIndex - (totalNodes - 1) / 2) * horizSpacing;
        const ly = 3.0 - leftPos.depth * vertSpacing;

        const branchGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(lx, ly, z),
        ]);
        const branchMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 });
        const branch = new THREE.Line(branchGeo, branchMat);
        group.add(branch);

        renderNode3D(node.left);
      }

      // Branch to Right child
      if (node.right) {
        const rightPos = positions.get(node.right.key);
        const rx = (rightPos.xIndex - (totalNodes - 1) / 2) * horizSpacing;
        const ry = 3.0 - rightPos.depth * vertSpacing;

        const branchGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(rx, ry, z),
        ]);
        const branchMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 });
        const branch = new THREE.Line(branchGeo, branchMat);
        group.add(branch);

        renderNode3D(node.right);
      }
    };

    renderNode3D(root);

    // Dynamic Camera Framing to ensure all nodes remain visible
    if (cameraRef.current && isFinite(minX) && isFinite(maxX)) {
      const treeWidth = maxX - minX;
      const treeHeight = maxY - minY;
      const requiredDist = Math.max(13, Math.max(treeWidth * 1.3, treeHeight * 1.6));
      cameraRef.current.position.z = requiredDist;
      cameraRef.current.position.y = (maxY + minY) / 2;
      cameraRef.current.lookAt(0, (maxY + minY) / 2, 0);
    }
  }, [root, highlightPath]);

  // Deep clone helper for React state purity
  const cloneTree = (node) => {
    if (!node) return null;
    const copy = new AVLNode(node.key);
    copy.height = node.height;
    copy.left = cloneTree(node.left);
    copy.right = cloneTree(node.right);
    return copy;
  };

  // Insert Key Action
  const handleInsert = (val) => {
    const raw = typeof val === 'number' ? val : inputVal.trim();
    const key = typeof val === 'number' ? val : parseInt(raw, 10);
    if (isNaN(key)) {
      setActionMessage('⚠️ Please enter a valid integer key.');
      return;
    }

    const rotationLogs = [];
    const flags = { isDuplicate: false };
    const newRoot = insertNode(root ? cloneTree(root) : null, key, autoBalance, rotationLogs, flags);

    if (flags.isDuplicate) {
      setActionMessage(`⚠️ Key ${key} already exists in the tree. Duplicates are rejected in strict BST.`);
      setHighlightPath([key]);
      addTimeout(() => setHighlightPath([]), 2000);
      return;
    }

    setRoot(newRoot);
    setInputVal('');
    setHighlightPath([key]);

    if (rotationLogs.length > 0) {
      setActionMessage(`Inserted key ${key}. ${rotationLogs.join(' • ')}`);
    } else {
      setActionMessage(`Inserted key ${key}. Tree height is now ${getHeight(newRoot)}, root is ${newRoot.key}.`);
    }

    addTimeout(() => setHighlightPath([]), 2500);
  };

  // Search Key Action
  const handleSearch = () => {
    const key = parseInt(inputVal.trim(), 10);
    if (isNaN(key)) {
      setActionMessage('⚠️ Please enter a valid integer key to search.');
      return;
    }

    const path = [];
    let curr = root;
    let found = false;

    while (curr) {
      path.push(curr.key);
      if (key === curr.key) {
        found = true;
        break;
      } else if (key < curr.key) {
        curr = curr.left;
      } else {
        curr = curr.right;
      }
    }

    setHighlightPath(path);
    if (found) {
      setActionMessage(`🔍 Key ${key} found! Traversal path: [${path.join(' → ')}] (${path.length} comparison${path.length > 1 ? 's' : ''}, O(log N)).`);
    } else {
      setActionMessage(`❌ Key ${key} not in tree. Search path ended at null: [${path.join(' → ')}] (${path.length} comparisons).`);
    }
  };

  // Reset Tree
  const handleReset = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    let tree = new AVLNode(30);
    tree = insertNode(tree, 15, true);
    tree = insertNode(tree, 50, true);
    tree = insertNode(tree, 10, true);
    tree = insertNode(tree, 20, true);
    setRoot(tree);
    setHighlightPath([]);
    setActionMessage('Tree reset to balanced initial state with keys [30, 15, 50, 10, 20].');
  };

  // Collect in-order list for accessible alternative
  const getInOrder = (node, acc = []) => {
    if (!node) return acc;
    getInOrder(node.left, acc);
    acc.push({ key: node.key, height: node.height, bf: getBalance(node) });
    getInOrder(node.right, acc);
    return acc;
  };

  const inOrderList = getInOrder(root);

  return (
    <div style={styles.container}>
      {/* 3D Visualizer Canvas or WebGL fallback */}
      {webglSupported ? (
        <div style={styles.canvasWrapper} ref={mountRef}>
          <div style={styles.sceneOverlay}>
            <div style={styles.statusBadge}>
              <span>Tree Height: <strong>{getHeight(root)}</strong></span>
              <span style={{ color: '#94a3b8' }}>•</span>
              <span>Total Nodes: <strong>{inOrderList.length}</strong></span>
              <span style={{ color: '#94a3b8' }}>•</span>
              <Badge variant={autoBalance ? 'emerald' : 'amber'} size="sm">
                {autoBalance ? 'AVL Balancing ON' : 'Unbalanced BST'}
              </Badge>
            </div>

            <div style={styles.legendRow}>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#3b82f6' }} />
                <span>Balanced</span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#f59e0b' }} />
                <span>Path / Found</span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#ef4444' }} />
                <span>|BF| &gt; 1</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.fallbackNotice}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <div>
            <strong>WebGL Acceleration Unavailable</strong>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#cbd5e1' }}>
              3D hardware rendering is unavailable. Tree structure and balance factors are accessible in the live tree table below.
            </p>
          </div>
        </div>
      )}

      {/* Action Event Callout Banner */}
      <div style={styles.actionBanner} role="status" aria-live="polite">
        <span style={{ fontSize: '15px' }}>📢</span>
        <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '500' }}>{actionMessage}</span>
      </div>

      {/* Interactive Controls Bar */}
      <div style={styles.controlsBar}>
        <div style={styles.inputRow}>
          <input
            type="number"
            placeholder="Key value..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            style={styles.numInput}
            aria-label="Tree key value"
          />
          <Button onClick={() => handleInsert()} variant="primary" size="sm" icon="+">
            Insert Key
          </Button>
          <Button onClick={handleSearch} variant="secondary" size="sm" icon="🔍">
            Search
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm" icon="↺">
            Reset
          </Button>
        </div>

        {/* Quick Presets */}
        <div style={styles.presetGroup}>
          <span style={styles.presetLabel}>Quick Insert:</span>
          {[25, 40, 5, 60, 35].map((k) => (
            <button
              key={k}
              onClick={() => handleInsert(k)}
              style={styles.quickKeyBtn}
              title={`Insert ${k}`}
            >
              +{k}
            </button>
          ))}
        </div>

        {/* Toggle Auto-Balance */}
        <button
          onClick={() => setAutoBalance((prev) => !prev)}
          style={{
            ...styles.balanceToggleBtn,
            background: autoBalance ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            borderColor: autoBalance ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
            color: autoBalance ? '#34d399' : '#fbbf24',
          }}
          aria-pressed={autoBalance}
        >
          {autoBalance ? '⚖️ Auto-Balancing: ON' : '⚠️ Auto-Balancing: OFF'}
        </button>

        <button
          onClick={() => setShowTextAlt((prev) => !prev)}
          style={styles.textAltToggleBtn}
          aria-expanded={showTextAlt}
        >
          {showTextAlt ? 'Hide Tabular Alternative' : '📊 View Tree Table'}
        </button>
      </div>

      {/* Accessible Tree Inspector Table */}
      {(showTextAlt || !webglSupported) && (
        <div style={styles.textAltSection}>
          <h4 style={styles.textAltTitle}>AVL Tree In-Order Traversal & Balance Metrics</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.stateTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Sorted Order</th>
                  <th style={styles.th}>Node Key</th>
                  <th style={styles.th}>Subtree Height</th>
                  <th style={styles.th}>Balance Factor (L - R)</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inOrderList.map((item, idx) => (
                  <tr key={item.key}>
                    <td style={styles.td}>#{idx + 1}</td>
                    <td style={styles.td}>
                      <strong style={{ color: '#38bdf8' }}>{item.key}</strong>
                    </td>
                    <td style={styles.td}>{item.height}</td>
                    <td style={styles.td}>
                      <span style={{ color: Math.abs(item.bf) > 1 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                        {item.bf > 0 ? `+${item.bf}` : item.bf}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <Badge variant={Math.abs(item.bf) <= 1 ? 'emerald' : 'rose'} size="sm">
                        {Math.abs(item.bf) <= 1 ? 'Balanced' : 'Imbalanced'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.theoryBox}>
            <h5 style={{ color: '#38bdf8', margin: '0 0 6px 0', fontSize: '13px' }}>
              📚 AVL Tree Properties & Guarantees:
            </h5>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.6 }}>
              <li>
                <strong>AVL Invariant:</strong> For every node in the tree, $|Height(Left) - Height(Right)| \le 1$.
              </li>
              <li>
                <strong>Rotations:</strong> Left-Left (LL) and Right-Right (RR) use single rotations; Left-Right (LR) and Right-Left (RL) use double rotations.
              </li>
              <li>
                <strong>Complexity:</strong> Guarantee strict $O(\log N)$ worst-case search, insertion, and deletion time.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
  },
  canvasWrapper: {
    width: '100%',
    height: '460px',
    borderRadius: '16px',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
  },
  fallbackNotice: {
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    color: '#fef3c7',
  },
  sceneOverlay: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    right: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    pointerEvents: 'none',
  },
  statusBadge: {
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    pointerEvents: 'auto',
  },
  legendRow: {
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    pointerEvents: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#e2e8f0',
    fontWeight: '600',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  actionBanner: {
    background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '10px',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  controlsBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  numInput: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#ffffff',
    fontSize: '13px',
    width: '110px',
    outline: 'none',
  },
  presetGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  presetLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quickKeyBtn: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    padding: '5px 8px',
    color: '#cbd5e1',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  balanceToggleBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  textAltToggleBtn: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  textAltSection: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  textAltTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  stateTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12.5px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: '11.5px',
    textTransform: 'uppercase',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    color: '#cbd5e1',
  },
  theoryBox: {
    background: 'rgba(2, 132, 199, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '10px',
    padding: '14px',
  },
};
