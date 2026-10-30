import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Badge from '../Badge';
import Button from '../Button';
import { isWebGLAvailable } from '../../utils/webglSupport';

const NODE_COUNT = 5;
const RADIUS = 4.2;

export default function DistributedConsensus3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const nodeMeshesRef = useRef([]);
  const packetsRef = useRef([]);
  const timeoutsRef = useRef([]);

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
  const [uncommittedEntries, setUncommittedEntries] = useState([]);
  const [actionLog, setActionLog] = useState('Cluster initialized in Term 1 with Node 1 as Leader.');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTextAlt, setShowTextAlt] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Colors
  const ROLE_COLORS = {
    LEADER: 0x10b981,    // Emerald green
    FOLLOWER: 0x38bdf8,  // Cyan
    CANDIDATE: 0xf59e0b, // Amber
    OFFLINE: 0x475569,   // Slate gray
  };

  // Safe timer helper
  const addTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // Helper to create or update a text sprite for labels
  const createTextSprite = (text, roleText = '', color = '#ffffff') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    if (ctx.roundRect) ctx.roundRect(8, 8, 240, 112, 16);
    else ctx.rect(8, 8, 240, 112);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 48);

    if (roleText) {
      ctx.fillStyle = color;
      ctx.font = 'bold 22px monospace';
      ctx.fillText(roleText, 128, 88);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.9, 0.95, 1);
    sprite.userData = { texture };
    return sprite;
  };

  // Update existing node sprite text without memory leak
  const updateNodeSprite = (item, node) => {
    if (!item || !item.label) return;
    const roleLabel = !node.online
      ? 'DEAD'
      : node.role === 'LEADER'
      ? `LEADER T${node.term}`
      : node.role === 'CANDIDATE'
      ? `CAND T${node.term}`
      : `FOLL T${node.term}`;

    const colorHex = !node.online
      ? '#64748b'
      : node.role === 'LEADER'
      ? '#10b981'
      : node.role === 'CANDIDATE'
      ? '#f59e0b'
      : '#38bdf8';

    // Dispose old texture
    if (item.label.userData && item.label.userData.texture) {
      item.label.userData.texture.dispose();
    }
    item.group.remove(item.label);
    item.label.material.dispose();

    const newSprite = createTextSprite(`N${node.id}`, roleLabel, colorHex);
    newSprite.position.set(0, 1.3, 0);
    item.group.add(newSprite);
    item.label = newSprite;
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
    camera.position.set(0, 8.5, 9.5);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

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

      const label = createTextSprite(`N${i + 1}`, i === 0 ? 'LEADER T1' : 'FOLL T1', i === 0 ? '#10b981' : '#38bdf8');
      label.position.set(0, 1.3, 0);
      group.add(label);

      scene.add(group);
      nodeMeshesRef.current.push({ group, sphere, label, index: i });
    }

    let rotAngle = 0;
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
          p.mesh.position.y = Math.sin(p.progress * Math.PI) * 1.2;
        }
      }

      rotAngle += 0.0015;
      scene.rotation.y = Math.sin(rotAngle) * 0.12;

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

      // Clean up packets
      packetsRef.current.forEach((p) => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
      packetsRef.current = [];

      // Clean up nodes and label textures
      nodeMeshesRef.current.forEach((item) => {
        if (item.label?.userData?.texture) item.label.userData.texture.dispose();
        if (item.label?.material) item.label.material.dispose();
        if (item.sphere?.geometry) item.sphere.geometry.dispose();
        if (item.sphere?.material) item.sphere.material.dispose();
      });
      nodeMeshesRef.current = [];

      ringGeo.dispose();
      ringMat.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync 3D Visual Mesh Colors and Text Sprites when state changes
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
      item.sphere.material.emissiveIntensity =
        node.role === 'LEADER' ? 0.45 : node.role === 'CANDIDATE' ? 0.35 : 0.15;
      item.sphere.scale.setScalar(node.role === 'LEADER' ? 1.15 : 1.0);

      // Update 3D label
      updateNodeSprite(item, node);
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
    if (isAnimating) return;
    const onlineNodes = nodes.filter((n) => n.online);
    if (onlineNodes.length < 3) {
      setActionLog('⚠️ Quorum impossible: fewer than 3 nodes are online (need 3/5 majority). Election aborted.');
      return;
    }

    // Pick candidate: prefer an online non-leader, else first online node
    const candidate = onlineNodes.find((n) => n.role !== 'LEADER') || onlineNodes[0];
    const candidateIdx = candidate.id - 1;
    const nextTerm = term + 1;
    setTerm(nextTerm);
    setIsAnimating(true);

    setActionLog(`Node ${candidate.id} election timeout fired! Advancing to Term ${nextTerm}, becoming CANDIDATE, and requesting votes...`);

    // Transition to Candidate (votes for itself)
    setNodes((prev) =>
      prev.map((n) => (n.id === candidate.id ? { ...n, role: 'CANDIDATE', term: nextTerm, votedFor: n.id } : n))
    );

    // Broadcast RequestVote packets (amber)
    onlineNodes.forEach((n) => {
      if (n.id !== candidate.id) {
        spawnPacket(candidateIdx, n.id - 1, 0xf59e0b);
      }
    });

    // Follower voting evaluation
    addTimeout(() => {
      // Each online node grants vote if it hasn't voted for someone else in this term
      let votesGranted = 1; // Self vote
      const voters = [candidate.id];

      onlineNodes.forEach((n) => {
        if (n.id !== candidate.id) {
          // In standard Raft, online follower grants vote to first candidate of new term
          votesGranted++;
          voters.push(n.id);
          spawnPacket(n.id - 1, candidateIdx, 0x10b981); // Vote grant ACK
        }
      });

      addTimeout(() => {
        if (votesGranted >= 3) {
          // Majority achieved -> Become Leader
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id === candidate.id) {
                return { ...n, role: 'LEADER', term: nextTerm, votedFor: candidate.id };
              }
              return n.online
                ? { ...n, role: 'FOLLOWER', term: nextTerm, votedFor: candidate.id }
                : n;
            })
          );
          setActionLog(
            `✨ Node ${candidate.id} won majority (${votesGranted}/5 votes from Nodes ${voters.join(', ')}). Elected LEADER for Term ${nextTerm}! Sending initial heartbeats.`
          );

          // Broadcast initial heartbeats from new leader
          onlineNodes.forEach((n) => {
            if (n.id !== candidate.id) {
              spawnPacket(candidateIdx, n.id - 1, 0x10b981);
            }
          });
        } else {
          // Split vote / no quorum
          setNodes((prev) =>
            prev.map((n) => (n.id === candidate.id ? { ...n, role: 'FOLLOWER', term: nextTerm } : n))
          );
          setActionLog(`❌ Node ${candidate.id} received only ${votesGranted}/5 votes. Election failed (no majority).`);
        }
        setIsAnimating(false);
      }, 700);
    }, 700);
  }, [nodes, term, isAnimating]);

  // Action 2: Send Heartbeats (Leader Maintenance)
  const sendHeartbeats = useCallback(() => {
    if (isAnimating) return;
    const leader = nodes.find((n) => n.role === 'LEADER' && n.online);
    if (!leader) {
      setActionLog('⚠️ Cannot send heartbeat: no online leader in the cluster. Trigger an election first.');
      return;
    }

    const leaderIdx = leader.id - 1;
    const onlineFollowers = nodes.filter((n) => n.online && n.id !== leader.id);

    setIsAnimating(true);
    setActionLog(`Leader Node ${leader.id} broadcasting heartbeats (AppendEntries RPC) to ${onlineFollowers.length} online followers...`);

    onlineFollowers.forEach((f) => {
      spawnPacket(leaderIdx, f.id - 1, 0x10b981);
    });

    addTimeout(() => {
      // Followers reset election timers and confirm term
      setNodes((prev) =>
        prev.map((n) => (n.online && n.id !== leader.id ? { ...n, term: leader.term, votedFor: leader.id } : n))
      );
      setActionLog(`💓 Heartbeat cycle complete: ${onlineFollowers.length} followers refreshed lease with Leader Node ${leader.id} in Term ${leader.term}.`);
      setIsAnimating(false);
    }, 600);
  }, [nodes, isAnimating]);

  // Action 3: Toggle Node Crash / Partition
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
        setActionLog(`⚠️ Leader (Node ${nodeId}) crashed! Remaining ${onlineCount} followers detect missing heartbeats. Trigger an election to establish new leader.`);
      } else if (onlineCount < 3) {
        setActionLog(`🚨 Critical: only ${onlineCount}/5 nodes online. Quorum lost! Cluster paused to prevent split-brain.`);
      } else {
        const target = updated.find((x) => x.id === nodeId);
        setActionLog(`Node ${nodeId} is now ${target.online ? 'ONLINE' : 'OFFLINE'}. (${onlineCount}/5 online${onlineCount >= 3 ? ' - Quorum healthy' : ''})`);
      }

      return updated;
    });
  };

  // Action 4: Propose Log Entry & Replicate
  const proposeLogEntry = () => {
    if (isAnimating) return;
    const leader = nodes.find((n) => n.role === 'LEADER' && n.online);
    if (!leader) {
      setActionLog('⚠️ Cannot propose log entry: no active online leader in the cluster.');
      return;
    }
    const onlineFollowers = nodes.filter((n) => n.online && n.id !== leader.id);
    const newEntry = `SET key_${logEntries.length + uncommittedEntries.length + 1}=${Math.floor(Math.random() * 100)}`;
    const leaderIdx = leader.id - 1;

    setIsAnimating(true);
    setActionLog(`Leader Node ${leader.id} proposing entry "${newEntry}". Replicating AppendEntries to online followers...`);

    // Broadcast log entry packets
    onlineFollowers.forEach((f) => {
      spawnPacket(leaderIdx, f.id - 1, 0x38bdf8);
    });

    addTimeout(() => {
      // Follower ACKs returned to leader
      onlineFollowers.forEach((f) => {
        spawnPacket(f.id - 1, leaderIdx, 0x10b981);
      });

      addTimeout(() => {
        const totalReplicated = 1 + onlineFollowers.length;
        if (totalReplicated >= 3) {
          setLogEntries((prev) => [...prev, newEntry]);
          setNodes((prev) =>
            prev.map((n) => (n.online ? { ...n, logCount: n.logCount + 1 } : n))
          );
          setActionLog(`✅ Entry "${newEntry}" committed to majority (${totalReplicated}/5 nodes). Safe to apply to state machine.`);
        } else {
          setUncommittedEntries((prev) => [...prev, newEntry]);
          setActionLog(`⚠️ Entry "${newEntry}" uncommitted: replicated to only ${totalReplicated}/5 nodes (quorum requires 3). Waiting for recovery.`);
        }
        setIsAnimating(false);
      }, 700);
    }, 700);
  };

  // Action 5: Reset Cluster
  const resetCluster = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setTerm(1);
    setNodes([
      { id: 1, role: 'LEADER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 2, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 3, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 4, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
      { id: 5, role: 'FOLLOWER', term: 1, votedFor: 1, logCount: 3, online: true },
    ]);
    setLogEntries(['SET x=1', 'SET y=2', 'SET z=3']);
    setUncommittedEntries([]);
    setIsAnimating(false);
    setActionLog('Cluster reset to default 5-node configuration with Node 1 as Leader.');
  };

  const onlineCount = nodes.filter((n) => n.online).length;
  const currentLeader = nodes.find((n) => n.role === 'LEADER' && n.online);

  return (
    <div style={styles.container}>
      {/* 3D Visualizer Canvas or WebGL fallback */}
      {webglSupported ? (
        <div style={styles.canvasWrapper} ref={mountRef}>
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
      ) : (
        <div style={styles.fallbackNotice}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <div>
            <strong>WebGL Acceleration Unavailable</strong>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#cbd5e1' }}>
              The 3D canvas is disabled in this environment. The cluster state, quorum arithmetic, and message protocols are fully interactive through the state table below.
            </p>
          </div>
        </div>
      )}

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
            onClick={sendHeartbeats}
            disabled={!currentLeader || isAnimating}
            variant="outline"
            size="sm"
            icon="💓"
          >
            Send Heartbeat
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
      {(showTextAlt || !webglSupported) && (
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
  controlGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
  },
  partitionGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
  },
  partitionLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginRight: '2px',
  },
  nodeToggleBtn: {
    padding: '5px 9px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: '700',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    letterSpacing: '0.04em',
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
