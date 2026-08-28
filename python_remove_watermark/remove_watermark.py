import cv2
import numpy as np


def remove_watermark(image_path, output_path):
    
    # Load image
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect bright watermark areas
    _, mask1 = cv2.threshold(gray, 235, 255, cv2.THRESH_BINARY)

    # Detect edges (for text/logo)
    edges = cv2.Canny(gray, 100, 200)

    # Combine masks
    mask = cv2.bitwise_or(mask1, edges)

    # Dilate mask so watermark area is fully covered
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)

    # Inpaint to remove watermark
    result = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)

    # Save result
    cv2.imwrite(output_path, result)

    print("Watermark removed →", output_path)


remove_watermark("input.jpg", "output.jpg")