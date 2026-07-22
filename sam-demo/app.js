// SAM interactive masking web demo.
// Runs only the lightweight SAM mask decoder in-browser (onnxruntime-web / wasm).
// The heavy image encoder was run once offline (tools/embed_demo_image.py) and its
// output (data/demo_embedding.bin) is fetched here as a precomputed tensor.

const CLASS_COLORS = {
  1: [255, 59, 48],   // dry spot
  2: [52, 199, 89],   // microlayer
  3: [10, 132, 255],  // bulk liquid
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const state = {
  activeClass: 1,
  points: [],       // [[x, y], ...] in natural image pixel coords
  labels: [],       // [1 or 0, ...]
  pendingMask: null, // Uint8Array (h*w), 1 where SAM suggests
  labelMap: null,    // Uint8Array (h*w), 0 = unset, else class id
  meta: null,
  session: null,
  baseImage: null,   // HTMLImageElement
  running: false,
};

function setStatus(text) {
  statusEl.textContent = text;
}

async function loadDemoAssets() {
  const meta = await (await fetch("data/demo_meta.json")).json();
  const embBuf = await (await fetch("data/demo_embedding.bin")).arrayBuffer();
  const embedding = new Float32Array(embBuf);

  const img = new Image();
  const imgLoaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  img.src = "data/demo_image.png";
  await imgLoaded;

  return { meta, embedding, img };
}

function drawScene() {
  const { meta } = state;
  ctx.drawImage(state.baseImage, 0, 0, meta.width, meta.height);

  if (state.labelMap) {
    blendLabelMap(state.labelMap, 0.45);
  }
  if (state.pendingMask) {
    blendMask(state.pendingMask, CLASS_COLORS[state.activeClass], 0.5);
  }

  for (let i = 0; i < state.points.length; i++) {
    const [x, y] = state.points[i];
    const positive = state.labels[i] === 1;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = positive ? "#ffd60a" : "#ff453a";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

function blendLabelMap(labelMap, alpha) {
  const { width, height } = state.meta;
  const frame = ctx.getImageData(0, 0, width, height);
  const d = frame.data;
  for (let i = 0; i < labelMap.length; i++) {
    const cls = labelMap[i];
    if (!cls) continue;
    const color = CLASS_COLORS[cls];
    const o = i * 4;
    d[o] = d[o] * (1 - alpha) + color[0] * alpha;
    d[o + 1] = d[o + 1] * (1 - alpha) + color[1] * alpha;
    d[o + 2] = d[o + 2] * (1 - alpha) + color[2] * alpha;
  }
  ctx.putImageData(frame, 0, 0);
}

function blendMask(mask, color, alpha) {
  const { width, height } = state.meta;
  const frame = ctx.getImageData(0, 0, width, height);
  const d = frame.data;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    d[o] = d[o] * (1 - alpha) + color[0] * alpha;
    d[o + 1] = d[o + 1] * (1 - alpha) + color[1] * alpha;
    d[o + 2] = d[o + 2] * (1 - alpha) + color[2] * alpha;
  }
  ctx.putImageData(frame, 0, 0);
}

function canvasEventToImageCoords(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(evt.clientX - rect.left) * scaleX, (evt.clientY - rect.top) * scaleY];
}

async function runDecoder() {
  if (state.points.length === 0) {
    state.pendingMask = null;
    drawScene();
    return;
  }
  if (state.running) return;
  state.running = true;
  setStatus("예측 중…");

  try {
    const { meta, embedding, session } = state;
    const encSize = meta.encoder_input_size;
    const scale = encSize / Math.max(meta.width, meta.height);

    const n = state.points.length;
    // Append one padding point (0,0) with label -1, as required by the SAM ONNX decoder
    // when no bounding box prompt is used.
    const coordsData = new Float32Array((n + 1) * 2);
    const labelsData = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) {
      coordsData[i * 2] = state.points[i][0] * scale;
      coordsData[i * 2 + 1] = state.points[i][1] * scale;
      labelsData[i] = state.labels[i];
    }
    coordsData[n * 2] = 0;
    coordsData[n * 2 + 1] = 0;
    labelsData[n] = -1;

    const feeds = {
      image_embeddings: new ort.Tensor("float32", embedding, [1, meta.embed_dim, ...meta.embed_size]),
      point_coords: new ort.Tensor("float32", coordsData, [1, n + 1, 2]),
      point_labels: new ort.Tensor("float32", labelsData, [1, n + 1]),
      mask_input: new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor("float32", new Float32Array([0]), [1]),
      orig_im_size: new ort.Tensor("float32", new Float32Array([meta.height, meta.width]), [2]),
    };

    const results = await session.run(feeds);
    const maskData = results.masks.data;
    const mask = new Uint8Array(meta.width * meta.height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = maskData[i] > 0 ? 1 : 0;
    }
    state.pendingMask = mask;
    const iou = results.iou_predictions.data[0];
    setStatus(`predicted mask IoU 예측치: ${iou.toFixed(3)}\n(a: 확정 / c: 점 지우기)`);
  } catch (err) {
    console.error(err);
    setStatus("예측 중 오류가 발생했습니다: " + err.message);
  } finally {
    state.running = false;
    drawScene();
  }
}

function acceptMask() {
  if (!state.pendingMask) return;
  for (let i = 0; i < state.pendingMask.length; i++) {
    if (state.pendingMask[i]) state.labelMap[i] = state.activeClass;
  }
  state.pendingMask = null;
  state.points = [];
  state.labels = [];
  drawScene();
}

function clearPoints() {
  state.pendingMask = null;
  state.points = [];
  state.labels = [];
  drawScene();
}

function resetLabels() {
  state.labelMap.fill(0);
  clearPoints();
}

function downloadLabelImage() {
  const { width, height } = state.meta;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  const frame = octx.createImageData(width, height);
  for (let i = 0; i < state.labelMap.length; i++) {
    const cls = state.labelMap[i];
    const color = cls ? CLASS_COLORS[cls] : [0, 0, 0];
    const o = i * 4;
    frame.data[o] = color[0];
    frame.data[o + 1] = color[1];
    frame.data[o + 2] = color[2];
    frame.data[o + 3] = 255;
  }
  octx.putImageData(frame, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sam_demo_label.png";
    a.click();
  });
}

function setActiveClass(cls) {
  state.activeClass = cls;
  document.querySelectorAll(".class-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.class) === cls);
  });
  drawScene();
}

function wireUi() {
  document.querySelectorAll(".class-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveClass(Number(btn.dataset.class)));
  });
  document.getElementById("btn-accept").addEventListener("click", acceptMask);
  document.getElementById("btn-clear-points").addEventListener("click", clearPoints);
  document.getElementById("btn-reset").addEventListener("click", resetLabels);
  document.getElementById("btn-download").addEventListener("click", downloadLabelImage);

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (evt) => {
    if (state.running) return;
    const [x, y] = canvasEventToImageCoords(evt);
    if (evt.button === 0) {
      state.points.push([x, y]);
      state.labels.push(1);
    } else if (evt.button === 2) {
      state.points.push([x, y]);
      state.labels.push(0);
    } else {
      return;
    }
    drawScene();
    runDecoder();
  });

  window.addEventListener("keydown", (evt) => {
    if (evt.key === "1" || evt.key === "2" || evt.key === "3") setActiveClass(Number(evt.key));
    else if (evt.key === "a") acceptMask();
    else if (evt.key === "c") clearPoints();
    else if (evt.key === "r") resetLabels();
  });
}

async function main() {
  wireUi();
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";

  setStatus("데모 이미지/임베딩을 불러오는 중…");
  const { meta, embedding, img } = await loadDemoAssets();
  state.meta = meta;
  state.embedding = embedding;
  state.baseImage = img;
  state.labelMap = new Uint8Array(meta.width * meta.height);

  canvas.width = meta.width;
  canvas.height = meta.height;
  drawScene();

  setStatus("SAM decoder 모델을 불러오는 중…");
  state.session = await ort.InferenceSession.create("models/sam_decoder.onnx", {
    executionProviders: ["wasm"],
  });

  setStatus("준비 완료! 사진을 좌클릭(포함)/우클릭(제외)해 영역을 지정해보세요.");
}

main();
