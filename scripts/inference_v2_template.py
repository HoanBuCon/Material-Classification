import cv2
import torch
import numpy as np
from ultralytics import YOLO
from torchvision import transforms, models
import torch.nn as nn
from PIL import Image

# --- CẤU HÌNH ---
YOLO_MODEL_PATH = '../best.pt'      # Đường dẫn đến model YOLO hiện tại (Stage 1)
CLASSIFIER_PATH = 'classifier_stage2_best.pth' # Đường dẫn đến model Classifier mới (Stage 2)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Các class của Classifier (Phải đúng thứ tự khi train)
CLASS_NAMES = ['Giay', 'KimLoai', 'Nhua', 'ThuyTinh', 'Vai'] 

class TwoStageDetector:
    def __init__(self):
        self.device = DEVICE
        print(f"Initializing Two-Stage Detector on {self.device}...")
        
        # 1. Load YOLO (Detector)
        self.detector = YOLO(YOLO_MODEL_PATH)
        
        # 2. Load Classifier (Stage 2)
        # Khởi tạo kiến trúc giống hệt lúc train (EfficientNet_B0)
        self.classifier = models.efficientnet_b0(weights=None)
        num_ftrs = self.classifier.classifier[1].in_features
        self.classifier.classifier[1] = nn.Linear(num_ftrs, len(CLASS_NAMES))
        
        # Load weights đã train
        try:
            self.classifier.load_state_dict(torch.load(CLASSIFIER_PATH, map_location=self.device))
            print("Classifier weights loaded successfully.")
        except FileNotFoundError:
            print(f"WARNING: Không tìm thấy {CLASSIFIER_PATH}. Chỉ chạy YOLO mode.")
            self.classifier = None
            
        if self.classifier:
            self.classifier.to(self.device)
            self.classifier.eval()

        # Transform cho classifier
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def predict(self, image):
        """
        Input: a numpy image (OpenCV format BGR)
        Output: image with boxes, list of objects
        """
        img_h, img_w = image.shape[:2]
        
        # -- STAGE 1: DETECTION --
        results = self.detector(image, stream=True)
        
        final_detections = []
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                w, h = x2 - x1, y2 - y1
                
                # Filter rác nhỏ
                if w < 30 or h < 30: continue
                
                # Crop ảnh object
                # Lưu ý: Cần xử lý biên
                x1_c = max(0, x1)
                y1_c = max(0, y1)
                x2_c = min(img_w, x2)
                y2_c = min(img_h, y2)
                
                crop_img = image[y1_c:y2_c, x1_c:x2_c]
                if crop_img.size == 0: continue

                # -- STAGE 2: CLASSIFICATION --
                label_name = "Unknown"
                conf = float(box.conf[0])
                
                if self.classifier:
                    # Chuyển BGR (OpenCV) -> RGB (PIL/Torch)
                    crop_img_rgb = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
                    pil_img = Image.fromarray(crop_img_rgb)
                    
                    # Preprocess
                    input_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
                    
                    # Inference
                    with torch.no_grad():
                        outputs = self.classifier(input_tensor)
                        probs = torch.nn.functional.softmax(outputs, dim=1)
                        top_p, top_class = probs.topk(1, dim=1)
                        
                        # Lấy class từ Stage 2
                        class_idx = top_class.item()
                        label_name = CLASS_NAMES[class_idx]
                        final_conf = top_p.item()
                        
                        # Optional: Combine với YOLO confidence nếu muốn
                        # conf = (conf + final_conf) / 2
                        conf = final_conf
                else:
                    # Fallback về YOLO class nếu chưa có classifier
                    cls_id = int(box.cls[0])
                    # Lưu ý: Cần map đúng ID của YOLO với tên
                    # Giả sử detector cũng dùng chung bộ class
                    label_name = self.detector.names[cls_id]

                final_detections.append({
                    "label": label_name,
                    "confidence": conf,
                    "box": [x1, y1, w, h]
                })

                # Vẽ lên ảnh
                color = (0, 255, 0)
                cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
                cv2.putText(image, f"{label_name} {conf:.2f}", (x1, y1 - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

        return image, final_detections

# --- DEMO RUN ---
if __name__ == "__main__":
    # Test trên 1 ảnh
    detector = TwoStageDetector()
    
    # img = cv2.imread("../test.jpg")
    # if img is not None:
    #     res_img, objs = detector.predict(img)
    #     cv2.imshow("Result", res_img)
    #     cv2.waitKey(0)
    print("Detector initialized. Ready for integration.")
