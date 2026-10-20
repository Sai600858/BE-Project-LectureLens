import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Badge from '../Badge';
import Button from '../Button';

const NODE_COUNT = 5;
const RADIUS = 4.2;

export default function DistributedConsensus3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const nodeMeshesRef = useRef([]);
  const packetsRef = useRef([]);

  // Cluster State
  const [nodes, setNodes] = useState([
    { id: 1, role: 'LEADER', term: 1, votedFor: 1, logCount: 3, online: true },
    { id: 2, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
    { id: 3, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
    { id: 4, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
    { id: 5, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
  ]);
  const [term, setTerm] = useState(1);
  const [logEntries, setLogEntries] = useState(['SET x=1', 'SET y=2', 'SET z=3']);
  const [actionLog, setActionLog] = useState('Cluster initialized in Term 1 with Node 1 as Leader.');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTextAlt, setShowTextAlt] = useState(false);

  // Colors
  const ROLE_COLORS = {
    LEADER: 0x10b981,    // Emerald green
    FOLLOWER: 0x38bdf8,  // Cyan
    CANDIDATE: 0xf59e0b, // Amber
    OFFLINE: 0x475569,   // Slate gray
  };

  // Helper to create a text sprite for labels
  const createTextSprite = (text, color = '#ffffff') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect ? ctx.roundRect(10, 10, 236, 108, 16) : ctx.rect(10, 10, 236, 108);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.8, 0.9, 1);
    return sprite;
  };

  // Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060911);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8.5, 9.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Connecting Network Ring
    const ringGeo = new THREE.RingGeometry(RADIUS - 0.05, RADIUS + 0.05, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);

    // Create 5 Node Meshes
    nodeMeshesRef.current = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const angle = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS;
      const z = Math.sin(angle) * RADIUS;

      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Sphere
      const sphereGeo = new THREE.SphereGeometry(0.7, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: i === 0 ? ROLE_COLORS.LEADER : ROLE_COLORS.FOLLOWER,
        roughness: 0.25,
        metalness: 0.1,
        emissive: i === 0 ? 0x059669 : 0x0284c7,
        emissiveIntensity: 0.35,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphere);

      // Label sprite
      const label = createTextSprite(`N${i + 1}`, i === 0 ? '#10b981' : '#38bdf8');
      label.position.set(0, 1.2, 0);
      group.add(label);

      scene.add(group);
      nodeMeshesRef.current.push({ group, sphere, label, index: i });
    }

    // Animation Loop
    let angle = 0;
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      // Animate travelling packets
      const packets = packetsRef.current;
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.progress += 0.025;
        if (p.progress >= 1) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          packets.splice(i, 1);
        } else {
          p.mesh.position.lerpVectors(p.fromPos, p.toPos, p.progress);
          // slight arc in height
          p.mesh.position.y = Math.sin(p.progress * Math.PI) * 1.2;
        }
      }

      // Gentle cluster rotation when idle
      angle += 0.0015;
      scene.rotation.y = Math.sin(angle) * 0.15;

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      // Dispose meshes
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, []);

  // Sync 3D Visual Mesh Colors when state changes
  useEffect(() => {
    if (!nodeMeshesRef.current || nodeMeshesRef.current.length === 0) return;

    nodes.forEach((node, idx) => {
      const item = nodeMeshesRef.current[idx];
      if (!item) return;

      const color = !node.online
        ? ROLE_COLORS.OFFLINE
        : ROLE_COLORS[node.role] || ROLE_COLORS.FOLLOWER;

      item.sphere.material.color.setHex(color);
      item.sphere.material.emissive.setHex(color);
      item.sphere.material.emissiveIntensity = node.role === 'LEADER' ? 0.45 : node.role === 'CANDIDATE' ? 0.35 : 0.15;
      item.sphere.scale.setScalar(node.role === 'LEADER' ? 1.15 : 1.0);
    });
  }, [nodes]);

  // Spawn visual 3D packet along node path
  const spawnPacket = (fromIdx, toIdx, colorHex) => {
    if (!sceneRef.current || !nodeMeshesRef.current[fromIdx] || !nodeMeshesRef.current[toIdx]) return;
    const fromPos = nodeMeshesRef.current[fromIdx].group.position.clone();
    const toPos = nodeMeshesRef.current[toIdx].group.position.clone();

    const geo = new THREE.SphereGeometry(0.2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(fromPos);
    sceneRef.current.add(mesh);

    packetsRef.current.push({ mesh, fromPos, toPos, progress: 0 });
  };

  // Action 1: Trigger Leader Election
  const triggerElection = useCallback(() => {
    const onlineNodes = nodes.filter((n) => n.online);
    if (onlineNodes.length < 3) {
      setActionLog('⚠️ Quorum impossible: fewer than 3 nodes are online (need 3/5 majority). Election aborted.');
      return;
    }

    // Pick first non-leader online node or node 2 to be candidate
    const candidate = onlineNodes.find((n) => n.role !== 'LEADER') || onlineNodes[0];
    const candidateIdx = candidate.id - 1;
    const newTerm = term + 1;
    setTerm(newTerm);
    setIsAnimating(true);

    setActionLog(`Node ${candidate.id} election timeout fired! Incrementing to Term ${newTerm}, becoming CANDIDATE, and requesting votes...`);

    // Transition to Candidate
    setNodes((prev) =>
      prev.map((n) => (n.id === candidate.id ? { ...n, role: 'CANDIDATE', term: newTerm, votedFor: n.id } : n))
    );

    // Send RequestVote packets to all other online nodes
    onlineNodes.forEach((n) => {
      if (n.id !== candidate.id) {
        spawnPacket(candidateIdx, n.id - 1, 0xf59e0b);
      }
    });

    // Receive votes after latency
    setTimeout(() => {
      const votesReceived = onlineNodes.length; // all online grant vote in this simplified demo
      if (votesReceived >= 3) {
        // Elect Leader
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === candidate.id) {
              return { ...n, role: 'LEADER', term: newTerm };
            }
            return n.online ? { ...n, role: 'FOLLOWER', term: newTerm, votedFor: candidate.id } : n;
          })
        );
        setActionLog(`✨ Node ${candidate.id} won majority (${votesReceived}/5 votes). Transitioned to LEADER for Term ${newTerm}! Sending initial heartbeats.`);

        // Broadcast initial heartbeats from new leader
        onlineNodes.forEach((n) => {
          if (n.id !== candidate.id) {
            spawnPacket(candidateIdx, n.id - 1, 0x10b981);
          }
        });
      } else {
        setActionLog(`❌ Node ${candidate.id} received only ${votesReceived} votes. Election failed (split vote).`);
      }
      setIsAnimating(false);
    }, 1200);
  }, [nodes, term]);

  // Action 2: Toggle Node Crash / Partition
  const toggleNodeOnline = (nodeId) => {
    setNodes((prev) => {
      const updated = prev.map((n) => {
        if (n.id === nodeId) {
          const nextOnline = !n.online;
          return {
            ...n,
            online: nextOnline,
            role: nextOnline ? 'FOLLOWER' : 'OFFLINE',
          };
        }
        return n;
      });

      const onlineCount = updated.filter((x) => x.online).length;
      const leader = updated.find((x) => x.role === 'LEADER' && x.online);

      if (!leader && onlineCount >= 3) {
        setActionLog(`⚠️ Leader (Node ${nodeId}) crashed! Remaining ${onlineCount} followers detect missing heartbeats. You can trigger a new election.`);
      } else if (onlineCount < 3) {
        setActionLog(`🚨 Critical: only ${onlineCount}/5 nodes online. Quorum lost! Cluster paused.`);
      } else {
        setActionLog(`Node ${nodeId} is now ${updated.find((x) => x.id === nodeId).online ? 'ONLINE' : 'OFFLINE'}. (${onlineCount}/5 online)`);
      }

      return updated;
    });
  };

  // Action 3: Propose Log Entry & Replicate
  const proposeLogEntry = () => {
    const leader = nodes.find((n) => n.role === 'LEADER' && n.online);
    if (!leader) {
      setActionLog('⚠️ Cannot propose log entry: no active online leader in the cluster.');
      return;
    }
    const onlineFollowers = nodes.filter((n) => n.online && n.id !== leader.id);
    const newEntry = `SET key_${logEntries.length + 1}=${Math.floor(Math.random() * 100)}`;
    const leaderIdx = leader.id - 1;

    setActionLog(`Leader Node ${leader.id} proposing entry "${newEntry}". Replicating AppendEntries to online followers...`);

    // Broadcast log entry packets
    onlineFollowers.forEach((f) => {
      spawnPacket(leaderIdx, f.id - 1, 0x38bdf8);
    });

    setTimeout(() => {
      // Follower ACKs returned to leader
      onlineFollowers.forEach((f) => {
        spawnPacket(f.id - 1, leaderIdx, 0x10b981);
      });

      setTimeout(() => {
        const totalReplicated = 1 + onlineFollowers.length;
        if (totalReplicated >= 3) {
          setLogEntries((prev) => [...prev, newEntry]);
          setNodes((prev) =>
            prev.map((n) => (n.online ? { ...n, logCount: n.logCount + 1 } : n))
          );
          setActionLog(`✅ Entry "${newEntry}" committed to majority (${totalReplicated}/5 nodes). Safe to apply to state machine.`);
        } else {
          setActionLog(`⚠️ Failed to replicate to quorum (${totalReplicated}/5). Entry not committed.`);
        }
      }, 700);
    }, 700);
  };

  // Action 4: Reset Cluster
  const resetCluster = () => {
    setTerm(1);
    setNodes([
      { id: 1, role: 'LEADER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 2, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 3, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 4, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 5, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
    ]);
    setLogEntries(['SET x=1', 'SET y=2', 'SET z=3']);
    setActionLog('Cluster reset to default 5-node configuration with Node 1 as Leader.');
  };

  const onlineCount = nodes.filter((n) => n.online).length;
  const currentLeader = nodes.find((n) => n.role === 'LEADER' && n.online);

  return (
    <div style={styles.container}>
      {/* 3D Visualizer Canvas */}
      <div style={styles.canvasWrapper} ref={mountRef}>
        {/* Floating In-Scene Legend */}
        <div style={styles.sceneOverlay}>
          <div style={styles.clusterStatusBadge}>
            <span style={{ fontSize: '13px' }}>Cluster Term: <strong>{term}</strong></span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ fontSize: '13px' }}>
              Online: <strong>{onlineCount}/5</strong> {onlineCount >= 3 ? '✅ Quorum' : '❌ No Quorum'}
            </span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <Badge variant={currentLeader ? 'emerald' : 'rose'} size="sm">
              {currentLeader ? `Leader: Node ${currentLeader.id}` : 'No Leader'}
            </Badge>
          </div>

          <div style={styles.legendRow}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: '#10b981' }} />
              <span>Leader</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: '#38bdf8' }} />
              <span>Follower</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: '#f59e0b' }} />
              <span>Candidate</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: '#64748b' }} />
              <span>Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Event Callout Banner */}
      <div style={styles.actionBanner} role="status" aria-live="polite">
        <span style={{ fontSize: '15px' }}>📢</span>
        <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '500' }}>{actionLog}</span>
      </div>

      {/* Interactive Controls Bar */}
      <div style={styles.controlsBar}>
        <div style={styles.controlGroup}>
          <Button
            onClick={triggerElection}
            disabled={isAnimating}
            variant="primary"
            size="sm"
            icon="⚡"
          >
            Trigger Leader Election
          </Button>

          <Button
            onClick={proposeLogEntry}
            disabled={!currentLeader || isAnimating}
            variant="emerald"
            size="sm"
            icon="📝"
          >
            Propose Log Entry
          </Button>

          <Button onClick={resetCluster} variant="secondary" size="sm" icon="↺">
            Reset Cluster
          </Button>
        </div>

        {/* Partition / Crash Toggles */}
        <div style={styles.partitionGroup}>
          <span style={styles.partitionLabel}>Toggle Node Status:</span>
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => toggleNodeOnline(n.id)}
              style={{
                ...styles.nodeToggleBtn,
                background: n.online ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: n.online ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                color: n.online ? '#38bdf8' : '#f87171',
              }}
              title={`Click to ${n.online ? 'crash' : 'revive'} Node ${n.id}`}
              aria-label={`Toggle Node ${n.id} online status. Currently ${n.online ? 'online' : 'offline'}`}
            >
              N{n.id}: {n.online ? 'Online' : 'Dead'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowTextAlt((prev) => !prev)}
          style={styles.textAltToggleBtn}
          aria-expanded={showTextAlt}
        >
          {showTextAlt ? 'Hide Tabular Alternative' : '📊 View Accessible State Table'}
        </button>
      </div>

      {/* Accessible Text Alternative & Algorithm Explanation */}
      {showTextAlt && (
        <div style={styles.textAltSection}>
          <h4 style={styles.textAltTitle}>Cluster Consensus State Table</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.stateTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Node</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Current Term</th>
                  <th style={styles.th}>Voted For</th>
                  <th style={styles.th}>Committed Logs</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.id} style={{ background: n.online ? 'transparent' : 'rgba(239, 68, 68, 0.08)' }}>
                    <td style={styles.td}><strong>Node {n.id}</strong></td>
                    <td style={styles.td}>
                      <Badge variant={n.role === 'LEADER' ? 'emerald' : n.role === 'CANDIDATE' ? 'amber' : 'cyan'} size="sm">
                        {n.role}
                      </Badge>
                    </td>
                    <td style={styles.td}>Term {n.term}</td>
                    <td style={styles.td}>{n.votedFor ? `Node ${n.votedFor}` : 'None'}</td>
                    <td style={styles.td}>{n.logCount} entries</td>
                    <td style={styles.td}>
                      <span style={{ color: n.online ? '#10b981' : '#f87171', fontWeight: '700' }}>
                        {n.online ? '● Online' : '✕ Offline (Partitioned)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.theoryBox}>
            <h5 style={{ color: '#38bdf8', margin: '0 0 6px 0', fontSize: '13px' }}>
              📚 Educational Concepts & Algorithm Guarantees:
            </h5>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.6 }}>
              <li>
                <strong>Quorum Arithmetic:</strong> In a cluster of $N=5$ nodes, any decision requires $\lfloor N/2 \rfloor + 1 = 3$ votes. This guarantees that any two quorums overlap by at least one node, preventing split-brain states.
              </li>
              <li>
                <strong>Leader Heartbeats:</strong> The Leader sends periodic <code>AppendEntries</code> RPCs without logs as heartbeats to suppress election timeouts across Followers.
              </li>
              <li>
                <strong>Election Safety:</strong> At most one leader can be elected per term. A Candidate only grants itself a vote and must solicit votes from a strict majority.
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
  clusterStatusBadge: {
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
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
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  partitionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  partitionLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: '4px',
  },
  nodeToggleBtn: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '72px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
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
