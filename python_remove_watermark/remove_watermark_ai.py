import cv2
import numpy as np
from lama_cleaner.model_manager import ModelManager
from lama_cleaner.schema import Config


def remove_watermark_ai(input_path, output_path):

    img = cv2.imread(input_path)

    # Convert to gray
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect bright watermark
    _, mask = cv2.threshold(gray, 235, 255, cv2.THRESH_BINARY)

    # Slightly enlarge mask
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)

    # Load AI model
    model = ModelManager(name="lama", device="cpu")

    config = Config(
        ldm_steps=20,
        hd_strategy="Original",
    )

    result = model(img, mask, config)

    cv2.imwrite(output_path, result)

    print("✅ AI watermark removed:", output_path)


remove_watermark_ai("input.jpg", "output.png")