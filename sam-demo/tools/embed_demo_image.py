"""
데모용 사진 한 장에 대해 SAM 이미지 인코더를 미리(offline) 돌려서 임베딩을 저장한다.
브라우저에서는 이 임베딩 + 가벼운 decoder(onnx)만 사용하므로, 무거운 인코더를
사용자 브라우저에서 실행할 필요가 없다.

사용법:
    python tools/embed_demo_image.py --image path/to/photo.png \
        --checkpoint ../checkpoints/sam_vit_b_01ec64.pth --model-type vit_b \
        --out-dir data

출력 (모두 --out-dir 안에 생성):
    demo_image.png        : 웹페이지에 표시할 원본 이미지 (RGB로 변환됨)
    demo_embedding.bin     : float32 raw binary, shape (1,256,64,64) (row-major)
    demo_meta.json         : {"width": W, "height": H, "embed_dim":256, "embed_size":[64,64]}
"""

import argparse
import json
import os

import cv2
import numpy as np


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True, help="데모로 쓸 이미지 파일 (png/jpg/tif 프레임을 미리 png로 저장)")
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--model-type", default="vit_b", choices=["vit_b", "vit_l", "vit_h"])
    p.add_argument("--out-dir", default="data")
    args = p.parse_args()

    from segment_anything import sam_model_registry, SamPredictor

    img = cv2.imread(args.image)
    if img is None:
        raise FileNotFoundError(args.image)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]

    sam = sam_model_registry[args.model_type](checkpoint=args.checkpoint)
    sam.to("cpu")
    predictor = SamPredictor(sam)
    predictor.set_image(img)
    embedding = predictor.get_image_embedding().cpu().numpy().astype(np.float32)
    print("embedding shape:", embedding.shape)

    os.makedirs(args.out_dir, exist_ok=True)

    cv2.imwrite(os.path.join(args.out_dir, "demo_image.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))

    embedding.tofile(os.path.join(args.out_dir, "demo_embedding.bin"))

    meta = {
        "width": int(w),
        "height": int(h),
        "embed_dim": int(embedding.shape[1]),
        "embed_size": [int(embedding.shape[2]), int(embedding.shape[3])],
        "model_type": args.model_type,
        "encoder_input_size": int(sam.image_encoder.img_size),
    }
    with open(os.path.join(args.out_dir, "demo_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("saved:", os.path.join(args.out_dir, "demo_image.png"))
    print("saved:", os.path.join(args.out_dir, "demo_embedding.bin"),
          f"({embedding.nbytes / 1e6:.2f} MB)")
    print("saved:", os.path.join(args.out_dir, "demo_meta.json"), meta)


if __name__ == "__main__":
    main()
