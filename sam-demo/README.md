# SAM Interactive Masking — 브라우저 데모

`sam_interactive_masking.py`의 클릭 → SAM 마스크 제안 워크플로를 브라우저에서 체험할 수 있게 만든
정적 웹 데모입니다. 서버 없이 GitHub Pages 같은 정적 호스팅에 폴더째로 올리면 바로 동작합니다.

## 동작 원리

- SAM은 이미지 인코더(무겁다, GPU 없이도 몇 초 걸림) + 마스크 디코더(가볍다, 수십 ms) 두 부분으로 나뉩니다.
- 이 데모는 **인코더를 오프라인에서 미리 한 번만** 돌려서, 데모 사진 한 장에 대한 이미지 임베딩을
  `data/demo_embedding.bin`으로 저장해둡니다.
- 브라우저에서는 **디코더만** `onnxruntime-web`(WASM)으로 실행합니다. 사용자가 클릭한 점 좌표 +
  미리 계산된 임베딩을 넣으면 곧바로 마스크가 나옵니다.
- 그래서 완전히 정적 파일만으로 동작하지만, **미리 임베딩해둔 사진에서만** 이 인터랙션이 가능합니다.
  (사용자가 임의로 업로드한 새 사진을 즉석에서 분할하려면 인코더도 서버/브라우저에서 돌려야 하므로
  이 방식만으로는 안 됩니다.)

## 폴더 구성

```
sam_web_demo/
  index.html          데모 페이지
  app.js               인터랙션 로직 (onnxruntime-web 호출)
  models/sam_decoder.onnx   SAM(vit_b) 디코더, 동적 양자화로 경량화 (~4.7MB)
  data/demo_image.png       데모용 사진 (20210219_bare/160_20frames.tif, 10번째 프레임)
  data/demo_embedding.bin   위 사진의 SAM 이미지 임베딩 (float32, 1x256x64x64, ~4.2MB)
  data/demo_meta.json       이미지 크기 등 메타데이터
  tools/export_onnx_decoder.py   체크포인트(.pth) -> decoder onnx export 스크립트
  tools/embed_demo_image.py      사진 한 장 -> 임베딩(.bin) 생성 스크립트
```

## 연구실 홈페이지에 넣는 방법

1. 이 `sam_web_demo` 폴더를 통째로 홈페이지 저장소 안(예: `docs/sam-demo/` 또는
   `static/sam-demo/`)에 복사합니다.
2. 홈페이지가 GitHub Pages를 쓰고 있다면 그대로 커밋 & 푸시하면
   `https://<사용자명>.github.io/<저장소명>/sam-demo/` 경로로 바로 접근 가능합니다.
3. 기존 홈페이지 페이지 안에 넣고 싶다면 `<iframe>`으로 임베드하면 됩니다.
   ```html
   <iframe src="/sam-demo/index.html" width="100%" height="600" style="border:0;"></iframe>
   ```
4. 파일 경로(특히 `models/`, `data/` fetch 경로)는 모두 `index.html` 기준 상대 경로이므로,
   폴더를 통째로 옮기기만 하면 별도 수정 없이 동작합니다.

## 다른 사진으로 데모 교체하기

새 SAM 체크포인트를 export할 필요는 없고(디코더는 모델 종류가 같으면 재사용 가능),
사진만 바꿀 때는 임베딩만 새로 계산하면 됩니다.

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install git+https://github.com/facebookresearch/segment-anything.git opencv-python tifffile

python tools/embed_demo_image.py \
    --image path/to/새사진.png \
    --checkpoint ../checkpoints/sam_vit_b_01ec64.pth \
    --model-type vit_b \
    --out-dir data
```

`data/demo_image.png`, `data/demo_embedding.bin`, `data/demo_meta.json` 세 파일이 새로 만들어집니다.
(멀티페이지 tif의 특정 프레임을 쓰려면 먼저 `cv2.imwrite` 등으로 png 한 장을 뽑아두세요.)

decoder(`models/sam_decoder.onnx`)를 다시 만들 일이 있다면(다른 vit 크기로 바꾸는 등):

```bash
python tools/export_onnx_decoder.py \
    --checkpoint ../checkpoints/sam_vit_b_01ec64.pth \
    --model-type vit_b \
    --output models/sam_decoder.onnx
```

## 로컬에서 미리보기

정적 파일이지만 `fetch()`로 데이터를 읽어오기 때문에 `file://`로 열면 CORS 문제로 안 됩니다.
아무 정적 서버로 이 폴더를 서빙해서 확인하세요.

```bash
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

## 원본 데스크톱 도구와의 차이

- 원본 `sam_interactive_masking.py`는 실제 라벨링 작업(여러 tif, 여러 프레임, 저장 등)에 쓰는 도구입니다.
- 이 웹 데모는 **한 장의 고정된 사진에 대한 체험용**입니다. contrast 조절(+/-, 원본 도구의 기능)은
  이미지 인코더를 다시 돌려야 해서 이 정적 버전에는 없습니다.
- 클래스 선택(1/2/3), 좌/우클릭 positive/negative, 확정(a)/점 지우기(c)/전체 초기화(r)는 원본과 동일한
  조작 방식을 그대로 따릅니다.
