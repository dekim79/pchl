"""
SAM mask decoder를 ONNX로 export하는 스크립트 (브라우저에서 onnxruntime-web으로 실행하기 위함).

이미지 인코더(무거운 ViT 부분)는 export하지 않는다. 대신 데모용 사진 한 장에 대해
미리 이미지 임베딩을 계산해서 저장해두고(embed_demo_image.py), 브라우저에서는
가벼운 decoder만 돌려서 클릭 -> 마스크 예측을 실시간으로 처리한다.

사용법:
    python tools/export_onnx_decoder.py --checkpoint ../checkpoints/sam_vit_b_01ec64.pth --model-type vit_b --output models/sam_decoder.onnx
"""

import argparse
import warnings

import torch

from segment_anything import sam_model_registry
from segment_anything.utils.onnx import SamOnnxModel


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--model-type", default="vit_b", choices=["vit_b", "vit_l", "vit_h"])
    p.add_argument("--output", default="models/sam_decoder.onnx")
    p.add_argument("--quantize", action="store_true", default=True)
    p.add_argument("--no-quantize", dest="quantize", action="store_false")
    p.add_argument("--opset", type=int, default=17)
    args = p.parse_args()

    sam = sam_model_registry[args.model_type](checkpoint=args.checkpoint)
    onnx_model = SamOnnxModel(sam, return_single_mask=True)

    dynamic_axes = {
        "point_coords": {1: "num_points"},
        "point_labels": {1: "num_points"},
    }

    embed_dim = sam.prompt_encoder.embed_dim
    embed_size = sam.prompt_encoder.image_embedding_size
    mask_input_size = [4 * x for x in embed_size]
    dummy_inputs = {
        "image_embeddings": torch.randn(1, embed_dim, *embed_size, dtype=torch.float),
        "point_coords": torch.randint(low=0, high=1024, size=(1, 5, 2), dtype=torch.float),
        "point_labels": torch.randint(low=0, high=4, size=(1, 5), dtype=torch.float),
        "mask_input": torch.randn(1, 1, *mask_input_size, dtype=torch.float),
        "has_mask_input": torch.tensor([1], dtype=torch.float),
        "orig_im_size": torch.tensor([1500, 2250], dtype=torch.float),
    }
    output_names = ["masks", "iou_predictions", "low_res_masks"]

    raw_path = args.output if not args.quantize else args.output + ".raw.onnx"

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=torch.jit.TracerWarning)
        warnings.filterwarnings("ignore", category=UserWarning)
        with open(raw_path, "wb") as f:
            torch.onnx.export(
                onnx_model,
                tuple(dummy_inputs.values()),
                f,
                export_params=True,
                verbose=False,
                opset_version=args.opset,
                do_constant_folding=True,
                input_names=list(dummy_inputs.keys()),
                output_names=output_names,
                dynamic_axes=dynamic_axes,
                dynamo=False,
            )
    print(f"exported raw onnx: {raw_path}")

    if args.quantize:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        quantize_dynamic(
            model_input=raw_path,
            model_output=args.output,
            per_channel=False,
            reduce_range=False,
            weight_type=QuantType.QUInt8,
        )
        print(f"quantized onnx: {args.output}")


if __name__ == "__main__":
    main()
