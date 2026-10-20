import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import Badge from '../Badge';
import Button from '../Button';

// Default Weight Presets
const PRESETS = {
  classifier: {
    name: 'Binary Classifier',
    desc: 'Separates inputs into Class A vs Class B with strong opposing hidden weights.',
    w1: [
      [1.4, -1.2, 0.8],
      [-1.1, 1.5, -0.6],
    ],
    b1: [0.1, -0.2, 0.0],
    w2: [
      [1.6, -1.5],
      [-1.4, 1.7],
      [0.9, -0.8],
    ],
    b2: [0.0, 0.0],
  },
  feature_detector: {
    name: 'Feature Extractor',
    desc: 'Positive reinforcement across shared hidden nodes.',
    w1: [
      [1.0, 0.8, 1.2],
      [0.9, 1.1, 0.7],
    ],
    b1: [-0.5, -0.3, -0.4],
    w2: [
      [1.2, 0.5],
      [0.8, 1.0],
      [1.1, 0.6],
    ],
    b2: [0.1, -0.1],
  },
  inhibitor: {
    name: 'Inhibitory Circuit',
    desc: 'Input 2 suppresses output 1; Input 1 suppresses output 2.',
    w1: [
      [1.8, -1.5, 0.5],
      [-1.6, 1.7, -0.5],
    ],
    b1: [0.0, 0.0, 0.0],
    w2: [
      [2.0, -1.8],
      [-1.8, 2.0],
      [0.2, -0.2],
    ],
    b2: [0.0, 0.0],
  },
};

// Math activation functions
function activate(val, type) {
  if (type === 'relu') return Math.max(0, val);
  if (type === 'tanh') return Math.tanh(val);
  // Default Sigmoid
  return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, val))));
}

export default function NeuralNetwork3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const neuronMeshesRef = useRef({ inputs: [], hiddens: [], outputs: [] });
  const synapseLinesRef = useRef([]);
  const pulsesRef = useRef([]);

  // Network State
  const [inputs, setInputs] = useState([0.8, 0.2]); // x1, x2
  const [activationFn, setActivationFn] = useState('sigmoid'); // 'sigmoid' | 'relu' | 'tanh'
  const [selectedPreset, setSelectedPreset] = useState('classifier');
  const [weights, setWeights] = useState(PRESETS.classifier);
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagationStage, setPropagationStage] = useState('idle'); // 'idle' | 'layer1' | 'layer2' | 'complete'
  const [showAccessibleTable, setShowAccessibleTable] = useState(false);
  const [actionLog, setActionLog] = useState('Network ready. Adjust inputs or click "Forward Pass" to calculate layer outputs.');

  // Check reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Real Mathematical Forward Propagation Calculation
  const computedLayers = useMemo(() => {
    const x = inputs;
    const { w1, b1, w2, b2 } = weights;

    // Hidden layer calculations: z_h = W1^T * x + b1
    const hiddenZ = [0, 1, 2].map((j) => {
      const dot = x[0] * w1[0][j] + x[1] * w1[1][j];
      return dot + b1[j];
    });

    // Activated hidden: a_h = f(z_h)
    const hiddenA = hiddenZ.map((z) => activate(z, activationFn));

    // Output layer calculations: z_o = W2^T * a_h + b2
    const outputZ = [0, 1].map((k) => {
      const dot = hiddenA[0] * w2[0][k] + hiddenA[1] * w2[1][k] + hiddenA[2] * w2[2][k];
      return dot + b2[k];
    });

    // Activated output: a_o = f(z_o)
    const outputA = outputZ.map((z) => activate(z, activationFn));

    // Softmax probabilities for output display
    const maxZ = Math.max(...outputZ);
    const expZ = outputZ.map((z) => Math.exp(z - maxZ));
    const sumExp = expZ.reduce((a, b) => a + b, 0);
    const softmax = expZ.map((e) => (sumExp === 0 ? 0.5 : e / sumExp));

    return { hiddenZ, hiddenA, outputZ, outputA, softmax };
  }, [inputs, weights, activationFn]);

  // Handle Preset Change
  const handlePresetChange = (presetKey) => {
    setSelectedPreset(presetKey);
    setWeights(PRESETS[presetKey]);
    setActionLog(`Applied preset "${PRESETS[presetKey].name}": ${PRESETS[presetKey].desc}`);
  };

  // Helper to create a text sprite for 3D neuron labels
  const createTextSprite = (text, subtext = '', color = '#38bdf8') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
    ctx.roundRect ? ctx.roundRect(8, 8, 240, 112, 16) : ctx.rect(8, 8, 240, 112);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text label
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 48);

    if (subtext) {
      ctx.fillStyle = color;
      ctx.font = '24px monospace';
      ctx.fillText(subtext, 128, 88);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.9, 0.95, 1);
    return { sprite, texture };
  };

  // Three.js Scene Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 460;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060911);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 13.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x38bdf8, 2.5, 30);
    pointLight.position.set(0, 4, 8);
    scene.add(pointLight);

    // Neuron Positioning Definitions
    // Layer 0: X = -4.5, 2 inputs at Y = 1.6, -1.6
    const inputPositions = [
      new THREE.Vector3(-4.5, 1.6, 0),
      new THREE.Vector3(-4.5, -1.6, 0),
    ];

    // Layer 1: X = 0, 3 hidden at Y = 2.4, 0, -2.4
    const hiddenPositions = [
      new THREE.Vector3(0, 2.4, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -2.4, 0),
    ];

    // Layer 2: X = +4.5, 2 outputs at Y = 1.6, -1.6
    const outputPositions = [
      new THREE.Vector3(4.5, 1.6, 0),
      new THREE.Vector3(4.5, -1.6, 0),
    ];

    const neuronSphereGeo = new THREE.SphereGeometry(0.75, 24, 24);
    const texturesToDispose = [];

    // Build Input Neurons
    const inputMeshes = inputPositions.map((pos, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(neuronSphereGeo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);

      const label = createTextSprite(`x${i + 1}`, `${inputs[i].toFixed(2)}`, '#38bdf8');
      label.sprite.position.set(pos.x, pos.y + 1.25, 0.5);
      scene.add(label.sprite);
      texturesToDispose.push(label.texture);

      return { mesh, label, pos };
    });

    // Build Hidden Neurons
    const hiddenMeshes = hiddenPositions.map((pos, j) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(neuronSphereGeo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);

      const label = createTextSprite(`h${j + 1}`, `${computedLayers.hiddenA[j].toFixed(2)}`, '#c084fc');
      label.sprite.position.set(pos.x, pos.y + 1.25, 0.5);
      scene.add(label.sprite);
      texturesToDispose.push(label.texture);

      return { mesh, label, pos };
    });

    // Build Output Neurons
    const outputMeshes = outputPositions.map((pos, k) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(neuronSphereGeo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);

      const label = createTextSprite(`y${k + 1}`, `${computedLayers.outputA[k].toFixed(2)}`, '#34d399');
      label.sprite.position.set(pos.x, pos.y + 1.25, 0.5);
      scene.add(label.sprite);
      texturesToDispose.push(label.texture);

      return { mesh, label, pos };
    });

    neuronMeshesRef.current = { inputs: inputMeshes, hiddens: hiddenMeshes, outputs: outputMeshes };

    // Build Synaptic Connection Lines
    const lines = [];

    // Layer 0 -> Layer 1 (2 x 3 = 6 connections)
    inputPositions.forEach((inPos, i) => {
      hiddenPositions.forEach((hidPos, j) => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([inPos, hidPos]);
        const wVal = weights.w1[i][j];
        const isPos = wVal >= 0;
        const lineMat = new THREE.LineBasicMaterial({
          color: isPos ? 0x10b981 : 0xf43f5e,
          transparent: true,
          opacity: Math.min(0.85, 0.2 + Math.abs(wVal) * 0.35),
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        scene.add(lineMesh);
        lines.push({ lineMesh, fromPos: inPos, toPos: hidPos, weight: wVal, type: 'layer1', i, j });
      });
    });

    // Layer 1 -> Layer 2 (3 x 2 = 6 connections)
    hiddenPositions.forEach((hidPos, j) => {
      outputPositions.forEach((outPos, k) => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([hidPos, outPos]);
        const wVal = weights.w2[j][k];
        const isPos = wVal >= 0;
        const lineMat = new THREE.LineBasicMaterial({
          color: isPos ? 0x10b981 : 0xf43f5e,
          transparent: true,
          opacity: Math.min(0.85, 0.2 + Math.abs(wVal) * 0.35),
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        scene.add(lineMesh);
        lines.push({ lineMesh, fromPos: hidPos, toPos: outPos, weight: wVal, type: 'layer2', j, k });
      });
    });

    synapseLinesRef.current = lines;

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      if (newW > 0 && newH > 0 && rendererRef.current) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    // Render / Animation Loop
    let lastTime = performance.now();
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Animate Active Pulses along synapses
      if (pulsesRef.current.length > 0) {
        for (let idx = pulsesRef.current.length - 1; idx >= 0; idx--) {
          const p = pulsesRef.current[idx];
          p.progress += dt * 1.8;
          if (p.progress >= 1.0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            pulsesRef.current.splice(idx, 1);
          } else {
            p.mesh.position.lerpVectors(p.fromPos, p.toPos, p.progress);
            // Slight glow pulse
            const pulseScale = 1.0 + Math.sin(p.progress * Math.PI) * 0.6;
            p.mesh.scale.setScalar(pulseScale);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on Unmount
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      resizeObserver.disconnect();

      // Dispose Pulses
      pulsesRef.current.forEach((p) => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
      pulsesRef.current = [];

      // Dispose Synapses
      lines.forEach((l) => {
        scene.remove(l.lineMesh);
        l.lineMesh.geometry.dispose();
        l.lineMesh.material.dispose();
      });

      // Dispose Neurons and Labels
      [...inputMeshes, ...hiddenMeshes, ...outputMeshes].forEach((item) => {
        scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
        scene.remove(item.label.sprite);
        item.label.sprite.material.dispose();
      });

      texturesToDispose.forEach((tex) => tex.dispose());
      neuronSphereGeo.dispose();

      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [weights]); // Recreate topology on weight preset switch

  // Update Neuron Visuals when values/activations change
  useEffect(() => {
    const meshes = neuronMeshesRef.current;
    if (!meshes || !meshes.inputs || meshes.inputs.length === 0) return;

    // Update Input Neurons
    inputs.forEach((val, i) => {
      if (meshes.inputs[i]) {
        const intensity = 0.2 + Math.min(1.0, Math.max(0, val)) * 0.7;
        meshes.inputs[i].mesh.material.emissiveIntensity = intensity;
      }
    });

    // Update Hidden Neurons
    computedLayers.hiddenA.forEach((act, j) => {
      if (meshes.hiddens[j]) {
        const intensity = 0.2 + Math.min(1.0, Math.max(0, act)) * 0.8;
        meshes.hiddens[j].mesh.material.emissiveIntensity = intensity;
        meshes.hiddens[j].mesh.scale.setScalar(0.9 + act * 0.3);
      }
    });

    // Update Output Neurons
    computedLayers.outputA.forEach((act, k) => {
      if (meshes.outputs[k]) {
        const intensity = 0.2 + Math.min(1.0, Math.max(0, act)) * 0.8;
        meshes.outputs[k].mesh.material.emissiveIntensity = intensity;
        meshes.outputs[k].mesh.scale.setScalar(0.9 + act * 0.3);
      }
    });
  }, [inputs, computedLayers]);

  // Spawn glowing pulse packets along synapses
  const firePulses = (layerType, colorHex) => {
    if (!sceneRef.current) return;
    const matchingSynapses = synapseLinesRef.current.filter((l) => l.type === layerType);

    const pulseGeo = new THREE.SphereGeometry(0.18, 12, 12);
    matchingSynapses.forEach((syn) => {
      const pulseMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pulseMesh.position.copy(syn.fromPos);
      sceneRef.current.add(pulseMesh);
      pulsesRef.current.push({
        mesh: pulseMesh,
        fromPos: syn.fromPos.clone(),
        toPos: syn.toPos.clone(),
        progress: 0,
      });
    });
  };

  // Trigger Forward Propagation Step-by-Step
  const triggerForwardPass = useCallback(() => {
    if (isPropagating) return;
    setIsPropagating(true);
    setPropagationStage('layer1');
    setActionLog(`1️⃣ Input layer [x1=${inputs[0].toFixed(2)}, x2=${inputs[1].toFixed(2)}] sends signals across Layer 1 synapses...`);

    // Fire Layer 1 pulses
    firePulses('layer1', 0x38bdf8);

    // Step 2: Hidden layer activation
    setTimeout(() => {
      setPropagationStage('layer2');
      setActionLog(
        `2️⃣ Hidden neurons activated (${activationFn.toUpperCase()}): h1=${computedLayers.hiddenA[0].toFixed(2)}, h2=${computedLayers.hiddenA[1].toFixed(2)}, h3=${computedLayers.hiddenA[2].toFixed(2)}. Sending signals to output layer...`
      );
      firePulses('layer2', 0xa855f7);
    }, 700);

    // Step 3: Output layer computed
    setTimeout(() => {
      setPropagationStage('complete');
      const winner = computedLayers.outputA[0] >= computedLayers.outputA[1] ? 'y1 (Class A)' : 'y2 (Class B)';
      setActionLog(
        `3️⃣ Output computed: y1=${computedLayers.outputA[0].toFixed(3)} (Softmax: ${(computedLayers.softmax[0] * 100).toFixed(1)}%), y2=${computedLayers.outputA[1].toFixed(3)} (Softmax: ${(computedLayers.softmax[1] * 100).toFixed(1)}%). Winning class: ${winner}.`
      );
      setIsPropagating(false);
    }, 1400);
  }, [isPropagating, inputs, computedLayers, activationFn]);

  // Input Slider Handler
  const handleInputChange = (idx, val) => {
    const num = parseFloat(val);
    setInputs((prev) => {
      const next = [...prev];
      next[idx] = num;
      return next;
    });
    setPropagationStage('idle');
    setActionLog(`Input x${idx + 1} adjusted to ${num.toFixed(2)}. Forward pass recalculated.`);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Educational Header & Scope Alert */}
      <div className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                Multi-Layer Perceptron (MLP) Feedforward Lab
              </h2>
              <Badge variant="cyan">3D Interactive</Badge>
              <Badge variant="neutral">2-3-2 Architecture</Badge>
            </div>
            <p className="text-xs text-text-muted">
              Interactive visualization of linear dot-product combinations $Z = W^T X + B$ followed by non-linear activation functions in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccessibleTable((prev) => !prev)}
              aria-label="Toggle mathematical calculation table"
            >
              {showAccessibleTable ? 'Hide Math Breakdown' : 'Show Math Breakdown'}
            </Button>
          </div>
        </div>

        {/* Educational Note & Limitations Alert */}
        <div className="bg-surface-base/80 border border-border-subtle rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
          <span className="font-semibold text-cyan-400">Educational Scope & Model Limitations:</span> This module simulates a complete, mathematically exact <strong className="text-text-primary">Feedforward Evaluation</strong> pass for a standard 3-layer neural network. It performs real matrix multiplication and non-linear activations. Notice: Backpropagation gradient descent (weight training) is omitted to allow direct manual inspection of synaptic weights and activation geometry.
        </div>
      </div>

      {/* Main Lab Grid: 3D Canvas + Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Three.js Viewport (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div
            className="relative w-full rounded-xl overflow-hidden border border-border-subtle bg-slate-950 shadow-card flex items-center justify-center min-h-[460px]"
            style={{ touchAction: 'none' }}
          >
            {/* Three.js DOM Mount */}
            <div ref={mountRef} className="w-full h-full min-h-[460px]" aria-hidden="true" />

            {/* In-Canvas Overlay Status Badges */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
              <Badge variant="cyan" size="sm">Input Layer (2)</Badge>
              <Badge variant="purple" size="sm">Hidden Layer (3)</Badge>
              <Badge variant="emerald" size="sm">Output Layer (2)</Badge>
            </div>

            {/* Synapse Weight Legend */}
            <div className="absolute bottom-3 left-3 right-3 bg-surface-card/90 backdrop-blur-md border border-border-subtle rounded-lg p-2.5 flex flex-wrap items-center justify-between text-[11px] text-text-muted gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <strong className="text-text-primary">Green:</strong> Positive Weight (Excitatory)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <strong className="text-text-primary">Red:</strong> Negative Weight (Inhibitory)
                </span>
              </div>
              <span>Line Opacity = Weight Magnitude |w|</span>
            </div>
          </div>

          {/* Action Log / Feedback Bar */}
          <div
            className="rounded-lg border border-border-subtle bg-surface-base px-3.5 py-2.5 text-xs font-mono text-cyan-300 min-h-[44px] flex items-center shadow-inner"
            role="status"
            aria-live="polite"
          >
            {actionLog}
          </div>
        </div>

        {/* Right Column: Interactive Parameter Controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Section: Activation & Forward Trigger */}
          <div className="rounded-xl border border-border-subtle bg-surface-card p-4 shadow-card flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider flex items-center justify-between">
              <span>Execution Controls</span>
              <span className="text-xs text-text-muted lowercase">step-by-step</span>
            </h3>

            {/* Trigger Button */}
            <Button
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2 py-3"
              onClick={triggerForwardPass}
              disabled={isPropagating}
              aria-label="Run forward propagation pass"
            >
              {isPropagating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                  Computing Forward Pass...
                </>
              ) : (
                <>
                  <span>⚡ Propagate Forward Pass</span>
                </>
              )}
            </Button>

            {/* Activation Function Selector */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border-subtle">
              <label htmlFor="activation-select" className="text-xs font-medium text-text-secondary">
                Non-Linear Activation Function $f(z)$
              </label>
              <div className="grid grid-cols-3 gap-2" id="activation-select">
                {['sigmoid', 'relu', 'tanh'].map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => {
                      setActivationFn(fn);
                      setActionLog(`Switched activation function to ${fn.toUpperCase()}.`);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all min-h-[44px] ${
                      activationFn === fn
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : 'border-border-subtle bg-surface-base text-text-secondary hover:text-text-primary'
                    }`}
                    aria-pressed={activationFn === fn}
                  >
                    {fn === 'sigmoid' ? 'Sigmoid σ(z)' : fn === 'relu' ? 'ReLU max(0,z)' : 'Tanh tanh(z)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Input Values Sliders */}
          <div className="rounded-xl border border-border-subtle bg-surface-card p-4 shadow-card flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Input Vector $X = [x_1, x_2]$
            </h3>

            {inputs.map((val, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-primary">
                    Input Neuron $x_{idx + 1}$
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{val.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-1.5"
                    max="1.5"
                    step="0.05"
                    value={val}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    className="w-full accent-cyan-400 cursor-pointer min-h-[44px]"
                    aria-label={`Adjust input value x${idx + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Section: Weight Presets */}
          <div className="rounded-xl border border-border-subtle bg-surface-card p-4 shadow-card flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Synaptic Weight Matrix Presets
            </h3>
            <div className="flex flex-col gap-2">
              {Object.keys(PRESETS).map((key) => {
                const item = PRESETS[key];
                const isSelected = selectedPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetChange(key)}
                    className={`p-3 text-left rounded-lg border transition-all min-h-[44px] flex flex-col gap-1 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-border-subtle bg-surface-base text-text-secondary hover:text-text-primary'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xs font-semibold text-text-primary">{item.name}</span>
                    <span className="text-[11px] text-text-muted leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Mathematical Breakdown & Fallback Table */}
      {showAccessibleTable && (
        <div className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card animate-fadeIn">
          <h3 className="text-base font-bold text-text-primary mb-3">
            Complete Mathematical Step-by-Step Proof
          </h3>
          <p className="text-xs text-text-muted mb-4">
            This verification table shows exact numerical values for each matrix multiplication and non-linear activation pass. Screen readers and users without WebGL can inspect the algorithm state directly here.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-border-subtle rounded-lg">
              <thead className="bg-surface-base text-text-secondary uppercase text-[11px] border-b border-border-subtle">
                <tr>
                  <th className="py-2.5 px-3">Neuron</th>
                  <th className="py-2.5 px-3">Pre-activation $z = \sum w_i x_i + b$</th>
                  <th className="py-2.5 px-3">Activation $a = f(z)$</th>
                  <th className="py-2.5 px-3">Softmax Prob.</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono">
                {/* Inputs */}
                {inputs.map((val, i) => (
                  <tr key={`in-${i}`} className="hover:bg-surface-base/50">
                    <td className="py-2 px-3 font-semibold text-cyan-400">Input $x_{i + 1}$</td>
                    <td className="py-2 px-3 text-text-muted">—</td>
                    <td className="py-2 px-3 text-text-primary">{val.toFixed(4)}</td>
                    <td className="py-2 px-3 text-text-muted">—</td>
                    <td className="py-2 px-3">
                      <Badge variant="cyan" size="sm">Signal Source</Badge>
                    </td>
                  </tr>
                ))}

                {/* Hidden Neurons */}
                {computedLayers.hiddenZ.map((z, j) => (
                  <tr key={`hid-${j}`} className="hover:bg-surface-base/50">
                    <td className="py-2 px-3 font-semibold text-purple-400">Hidden $h_{j + 1}$</td>
                    <td className="py-2 px-3 text-text-secondary">
                      ({inputs[0].toFixed(2)} × {weights.w1[0][j].toFixed(2)}) + ({inputs[1].toFixed(2)} × {weights.w1[1][j].toFixed(2)}) + {weights.b1[j].toFixed(2)} = <strong className="text-text-primary">{z.toFixed(4)}</strong>
                    </td>
                    <td className="py-2 px-3 text-purple-300 font-bold">{computedLayers.hiddenA[j].toFixed(4)}</td>
                    <td className="py-2 px-3 text-text-muted">—</td>
                    <td className="py-2 px-3">
                      <Badge variant="purple" size="sm">Latent Feature</Badge>
                    </td>
                  </tr>
                ))}

                {/* Output Neurons */}
                {computedLayers.outputZ.map((z, k) => (
                  <tr key={`out-${k}`} className="hover:bg-surface-base/50">
                    <td className="py-2 px-3 font-semibold text-emerald-400">Output $y_{k + 1}$</td>
                    <td className="py-2 px-3 text-text-secondary">
                      ({computedLayers.hiddenA[0].toFixed(2)} × {weights.w2[0][k].toFixed(2)}) + ({computedLayers.hiddenA[1].toFixed(2)} × {weights.w2[1][k].toFixed(2)}) + ({computedLayers.hiddenA[2].toFixed(2)} × {weights.w2[2][k].toFixed(2)}) + {weights.b2[k].toFixed(2)} = <strong className="text-text-primary">{z.toFixed(4)}</strong>
                    </td>
                    <td className="py-2 px-3 text-emerald-300 font-bold">{computedLayers.outputA[k].toFixed(4)}</td>
                    <td className="py-2 px-3 text-amber-300 font-bold">{(computedLayers.softmax[k] * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3">
                      <Badge variant={k === (computedLayers.outputA[0] >= computedLayers.outputA[1] ? 0 : 1) ? 'emerald' : 'neutral'} size="sm">
                        {k === (computedLayers.outputA[0] >= computedLayers.outputA[1] ? 0 : 1) ? 'Predicted Class' : 'Alternative'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
