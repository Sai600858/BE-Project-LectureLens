import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Badge from '../Badge';
import Button from '../Button';

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

function insertNode(node, key, autoBalance = true, rotationLogs = []) {
  if (!node) return new AVLNode(key);

  if (key < node.key) {
    node.left = insertNode(node.left, key, autoBalance, rotationLogs);
  } else if (key > node.key) {
    node.right = insertNode(node.right, key, autoBalance, rotationLogs);
  } else {
    return node; // Duplicate keys not inserted
  }

  node.height = 1 + Math.max(getHeight(node.left), getHeight(node.right));

  if (!autoBalance) return node;

  const balance = getBalance(node);

  // Left Left Case
  if (balance > 1 && key < node.left.key) {
    rotationLogs.push(`🔄 Right Rotation on Node ${node.key} (Left-Left heavy)`);
    return rightRotate(node);
  }

  // Right Right Case
  if (balance < -1 && key > node.right.key) {
    rotationLogs.push(`🔄 Left Rotation on Node ${node.key} (Right-Right heavy)`);
    return leftRotate(node);
  }

  // Left Right Case
  if (balance > 1 && key > node.left.key) {
    rotationLogs.push(`🔄 Left-Right Double Rotation on Node ${node.key}`);
    node.left = leftRotate(node.left);
    return rightRotate(node);
  }

  // Right Left Case
  if (balance < -1 && key < node.right.key) {
    rotationLogs.push(`🔄 Right-Left Double Rotation on Node ${node.key}`);
    node.right = rightRotate(node.right);
    return leftRotate(node);
  }

  return node;
}

export default function AvlTree3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const objectsGroupRef = useRef(null);

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

  // Text label sprite generator
  const createNodeSprite = (text, sub = '') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect ? ctx.roundRect(10, 10, 236, 108, 16) : ctx.rect(10, 10, 236, 108);
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
      ctx.font = '22px sans-serif';
      ctx.fillText(sub, 128, 92);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  };

  // Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060911);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 13);
    camera.lookAt(0, -1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);
    objectsGroupRef.current = objectsGroup;

    // Animation Loop
    let angle = 0;
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      angle += 0.002;
      objectsGroup.rotation.y = Math.sin(angle) * 0.1;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      ro.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, []);

  // Render 3D Tree Mesh Layout
  useEffect(() => {
    const group = objectsGroupRef.current;
    if (!group) return;

    // Clear previous tree objects
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    if (!root) return;

    // Recursive layout calculator
    const build3DTree = (node, x, y, z, xOffset, depth) => {
      if (!node) return;

      const isHighlighted = highlightPath.includes(node.key);
      const bf = getBalance(node);
      const isUnbalanced = Math.abs(bf) > 1;

      // Node Sphere
      const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
      const color = isHighlighted
        ? 0xf59e0b
        : isUnbalanced
        ? 0xef4444
        : 0x3b82f6;

      const sphereMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isHighlighted ? 0.6 : 0.25,
        roughness: 0.3,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      group.add(sphere);

      // Node Label Sprite
      const sprite = createNodeSprite(node.key, `H:${node.height} BF:${bf}`);
      sprite.position.set(x, y + 0.9, z);
      group.add(sprite);

      // Branch to Left
      if (node.left) {
        const leftX = x - xOffset;
        const leftY = y - 1.8;
        const branchGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(leftX, leftY, z),
        ]);
        const branchMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 2 });
        const branch = new THREE.Line(branchGeo, branchMat);
        group.add(branch);

        build3DTree(node.left, leftX, leftY, z, xOffset * 0.52, depth + 1);
      }

      // Branch to Right
      if (node.right) {
        const rightX = x + xOffset;
        const rightY = y - 1.8;
        const branchGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(rightX, rightY, z),
        ]);
        const branchMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 2 });
        const branch = new THREE.Line(branchGeo, branchMat);
        group.add(branch);

        build3DTree(node.right, rightX, rightY, z, xOffset * 0.52, depth + 1);
      }
    };

    // Center root around (0, 2.5, 0)
    build3DTree(root, 0, 2.2, 0, 3.2, 0);
  }, [root, highlightPath]);

  // Insert Key Action
  const handleInsert = (val) => {
    const key = typeof val === 'number' ? val : parseInt(inputVal.trim(), 10);
    if (isNaN(key)) return;

    const rotationLogs = [];
    const newRoot = insertNode(root ? cloneTree(root) : null, key, autoBalance, rotationLogs);
    setRoot(newRoot);
    setInputVal('');
    setHighlightPath([key]);

    if (rotationLogs.length > 0) {
      setActionMessage(`Inserted ${key}. ${rotationLogs.join(' • ')}`);
    } else {
      setActionMessage(`Inserted key ${key}. Tree height is now ${getHeight(newRoot)}.`);
    }

    setTimeout(() => setHighlightPath([]), 2000);
  };

  // Search Key Action
  const handleSearch = () => {
    const key = parseInt(inputVal.trim(), 10);
    if (isNaN(key)) return;

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
      setActionMessage(`🔍 Key ${key} found! Traversal path: [${path.join(' → ')}].`);
    } else {
      setActionMessage(`❌ Key ${key} not in tree. Search path ended at null: [${path.join(' → ')}].`);
    }
  };

  // Deep clone helper for React state purity
  const cloneTree = (node) => {
    if (!node) return null;
    const copy = new AVLNode(node.key);
    copy.height = node.height;
    copy.left = cloneTree(node.left);
    copy.right = cloneTree(node.right);
    return copy;
  };

  // Reset Tree
  const handleReset = () => {
    let tree = new AVLNode(30);
    tree = insertNode(tree, 15, true);
    tree = insertNode(tree, 50, true);
    tree = insertNode(tree, 10, true);
    tree = insertNode(tree, 20, true);
    setRoot(tree);
    setHighlightPath([]);
    setActionMessage('Tree reset to balanced initial state.');
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
      {/* 3D Visualizer Canvas */}
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
            Insert
          </Button>
          <Button onClick={handleSearch} variant="secondary" size="sm" icon="🔍">
            Search
          </Button>
        </div>

        {/* Quick Presets */}
        <div style={styles.presetGroup}>
          <span style={styles.presetLabel}>Quick Keys:</span>
          {[25, 40, 5, 60, 35].map((k) => (
            <button
              key={k}
              onClick={() => handleInsert(k)}
              style={styles.quickKeyBtn}
              title={`Insert key ${k}`}
              aria-label={`Insert key ${k}`}
            >
              +{k}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setAutoBalance(!autoBalance)}
            style={{
              ...styles.toggleBalanceBtn,
              background: autoBalance ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              borderColor: autoBalance ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              color: autoBalance ? '#34d399' : '#fbbf24',
            }}
            aria-label={`Toggle AVL auto balancing. Currently ${autoBalance ? 'enabled' : 'disabled'}`}
          >
            {autoBalance ? '⚖️ Auto-AVL: ON' : '⚠️ Auto-AVL: OFF'}
          </button>

          <Button onClick={handleReset} variant="secondary" size="sm" icon="↺">
            Reset
          </Button>

          <button
            onClick={() => setShowTextAlt((prev) => !prev)}
            style={styles.textAltToggleBtn}
            aria-expanded={showTextAlt}
          >
            {showTextAlt ? 'Hide In-Order Table' : '📊 View In-Order Table'}
          </button>
        </div>
      </div>

      {/* Accessible Text Alternative & Algorithm Explanation */}
      {showTextAlt && (
        <div style={styles.textAltSection}>
          <h4 style={styles.textAltTitle}>BST In-Order Traversal & Balance Factor Breakdown</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.stateTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Key Value</th>
                  <th style={styles.th}>Subtree Height ($H$)</th>
                  <th style={styles.th}>Balance Factor ($BF = H_L - H_R$)</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inOrderList.map((item) => (
                  <tr key={item.key}>
                    <td style={styles.td}><strong>{item.key}</strong></td>
                    <td style={styles.td}>{item.height}</td>
                    <td style={styles.td}>
                      <span style={{ color: Math.abs(item.bf) > 1 ? '#ef4444' : '#38bdf8', fontWeight: '700' }}>
                        {item.bf}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {Math.abs(item.bf) > 1 ? (
                        <Badge variant="rose" size="sm">Unbalanced (|BF| &gt; 1)</Badge>
                      ) : (
                        <Badge variant="emerald" size="sm">Balanced</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.theoryBox}>
            <h5 style={{ color: '#38bdf8', margin: '0 0 6px 0', fontSize: '13px' }}>
              📚 AVL Balancing & Rotation Rules:
            </h5>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.6 }}>
              <li>
                <strong>Height-Balancing Property:</strong> An AVL tree enforces $|H(\text{Left}) - H(\text{Right})| \le 1$ at every node, maintaining $O(\log N)$ worst-case lookup time.
              </li>
              <li>
                <strong>Left-Left (LL) Heavy:</strong> Fixed by a single Right Rotation.
              </li>
              <li>
                <strong>Right-Right (RR) Heavy:</strong> Fixed by a single Left Rotation.
              </li>
              <li>
                <strong>Left-Right (LR) Heavy:</strong> Requires a double rotation: Left rotate the left child, then Right rotate the node.
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
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '10px',
    padding: '10px 16px',
  },
  controlsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '14px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  numInput: {
    background: 'rgba(8, 12, 20, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13.5px',
    width: '110px',
    outline: 'none',
    minHeight: '44px',
  },
  presetGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  presetLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: '2px',
  },
  quickKeyBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#38bdf8',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBalanceBtn: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12.5px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
  },
  textAltToggleBtn: {
    background: 'transparent',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    minHeight: '44px',
  },
  textAltSection: {
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  textAltTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  stateTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    color: '#94a3b8',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontWeight: '700',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#e2e8f0',
  },
  theoryBox: {
    background: 'rgba(8, 12, 20, 0.7)',
    borderLeft: '3px solid #38bdf8',
    borderRadius: '8px',
    padding: '12px 16px',
  },
};
