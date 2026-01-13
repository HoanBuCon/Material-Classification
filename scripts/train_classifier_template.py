import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader
import os
import time

# --- CẤU HÌNH ---
DATA_DIR = "dataset_crops"  # Thư mục chứa ảnh đã crop theo từng class. Cấu trúc: train/Nhua, train/Giay...
NUM_CLASSES = 5
BATCH_SIZE = 32
EPOCHS = 20
LEARNING_RATE = 0.001
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def train_classifier():
    # 1. Data Augmentation & Preprocessing
    # Tăng cường dữ liệu giúp model phân biệt tốt hơn các biến thể của vật liệu
    data_transforms = {
        'train': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15), # Xoay nhẹ
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2), # Đổi màu nhẹ để tránh overfitting màu sắc
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    # 2. Load Data
    if not os.path.exists(DATA_DIR):
        print(f"LỖI: Không tìm thấy thư mục '{DATA_DIR}'.")
        print("Vui lòng tạo thư mục và cấu trúc sau trước khi chạy:")
        print("dataset_crops/")
        print("  train/")
        print("    Giay/")
        print("    KimLoai/")
        print("    Nhua/")
        print("    ThuyTinh/")
        print("    Vai/")
        print("  val/")
        print("    (tương tự train)")
        return

    image_datasets = {x: datasets.ImageFolder(os.path.join(DATA_DIR, x), data_transforms[x]) 
                      for x in ['train', 'val']}
    dataloaders = {x: DataLoader(image_datasets[x], batch_size=BATCH_SIZE, shuffle=True, num_workers=2) 
                   for x in ['train', 'val']}
    dataset_sizes = {x: len(image_datasets[x]) for x in ['train', 'val']}
    class_names = image_datasets['train'].classes
    print(f"Classes found: {class_names}")

    # 3. Khởi tạo Model (Sử dụng EfficientNet_B0 - Tốt cho ImageNet transfer learning)
    print("Đang tải model EfficientNet_B0 (Pretrained)...")
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    
    # Thay đổi lớp Fully Connected cuối cùng
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, NUM_CLASSES)
    
    model = model.to(DEVICE)

    criterion = nn.CrossEntropyLoss()
    # Optimizer Adam thường hội tụ nhanh hơn SGD cho task này
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    # Giảm Learning Rate sau mỗi 7 epochs
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=7, gamma=0.1)

    # 4. Training Loop
    since = time.time()
    best_acc = 0.0
    best_model_wts = model.state_dict()

    for epoch in range(EPOCHS):
        print(f'Epoch {epoch+1}/{EPOCHS}')
        print('-' * 10)

        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
            else:
                model.eval()

            running_loss = 0.0
            running_corrects = 0

            for inputs, labels in dataloaders[phase]:
                inputs = inputs.to(DEVICE)
                labels = labels.to(DEVICE)

                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)
            
            if phase == 'train':
                scheduler.step()

            epoch_loss = running_loss / dataset_sizes[phase]
            epoch_acc = running_corrects.double() / dataset_sizes[phase]

            print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')

            # Deep copy model nếu độ chính xác tốt hơn
            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = model.state_dict()

    time_elapsed = time.time() - since
    print(f'Training complete in {time_elapsed // 60:.0f}m {time_elapsed % 60:.0f}s')
    print(f'Best val Acc: {best_acc:4f}')

    # Lưu model
    model.load_state_dict(best_model_wts)
    torch.save(model.state_dict(), 'classifier_stage2_best.pth')
    print("Đã lưu model vào 'classifier_stage2_best.pth'. Hãy dùng file này cho app chính.")

if __name__ == '__main__':
    train_classifier()
