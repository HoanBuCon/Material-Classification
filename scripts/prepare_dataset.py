import cv2
import os
from ultralytics import YOLO
from tqdm import tqdm
import argparse

# --- CẤU HÌNH ---
MODEL_PATH = '../best.pt'   # Sử dụng model YOLO hiện tại để pre-label
INPUT_DIR = '../raw_data'   # Thư mục chứa ảnh gốc (User cần thay đổi)
OUTPUT_DIR = '../dataset_crops/train' # Thư mục đầu ra
CONF_THRESHOLD = 0.4

def crop_objects(input_dir, output_dir, model_path):
    print(f"Load model từ: {model_path}")
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"Lỗi load model: {e}")
        return

    # Tạo thư mục output
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Lấy danh sách ảnh
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp')
    image_files = []
    for root, dirs, files in os.walk(input_dir):
        for file in files:
            if file.lower().endswith(valid_extensions):
                image_files.append(os.path.join(root, file))
    
    print(f"Tìm thấy {len(image_files)} ảnh. Bắt đầu xử lý...")

    count = 0
    for img_path in tqdm(image_files):
        try:
            img = cv2.imread(img_path)
            if img is None: continue
            
            # Predict
            results = model(img, verbose=False)
            
            for r in results:
                boxes = r.boxes
                for i, box in enumerate(boxes):
                    # Lấy thông tin
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label_name = model.names[cls]
                    
                    if conf < CONF_THRESHOLD: continue
                    
                    # Crop
                    h, w = img.shape[:2]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    
                    crop = img[y1:y2, x1:x2]
                    if crop.size == 0: continue
                    
                    # Lưu ảnh crop vào thư mục class tương ứng
                    class_dir = os.path.join(output_dir, label_name)
                    os.makedirs(class_dir, exist_ok=True)
                    
                    filename = os.path.basename(img_path)
                    name, ext = os.path.splitext(filename)
                    save_name = f"{name}_crop_{i}{ext}"
                    cv2.imwrite(os.path.join(class_dir, save_name), crop)
                    count += 1
                    
        except Exception as e:
            print(f"Lỗi khi xử lý {img_path}: {e}")

    print(f"Hoàn tất! Đã tạo {count} ảnh crop tại '{output_dir}'.")
    print("Vui lòng kiểm tra lại thủ công các thư mục để đảm bảo nhãn đúng trước khi train Classifier.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tool cắt ảnh tự động từ YOLO để làm dữ liệu train Classifier")
    parser.add_argument("--source", type=str, default="../input_images", help="Thư mục chứa ảnh gốc")
    parser.add_argument("--dest", type=str, default="../dataset_crops/train", help="Thư mục chứa ảnh crop đầu ra")
    parser.add_argument("--model", type=str, default="../best.pt", help="Đường dẫn model YOLO")
    
    args = parser.parse_args()
    
    crop_objects(args.source, args.dest, args.model)
