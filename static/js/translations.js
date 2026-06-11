// Cấu hình phân loại vật liệu tái chế và thùng rác gợi ý
const materialConfig = {
    'Giay': {
        class: 'badge-blue',
        nameVi: 'Giấy',
        nameEn: 'Paper',
        binVi: 'Thùng Vàng (Tái chế)',
        binEn: 'Yellow Bin (Recyclable)',
        binColor: '#eab308'
    },
    'KimLoai': {
        class: 'badge-gray',
        nameVi: 'Kim loại',
        nameEn: 'Metal',
        binVi: 'Thùng Vàng (Tái chế)',
        binEn: 'Yellow Bin (Recyclable)',
        binColor: '#eab308'
    },
    'Nhua': {
        class: 'badge-amber',
        nameVi: 'Nhựa',
        nameEn: 'Plastic',
        binVi: 'Thùng Vàng (Tái chế)',
        binEn: 'Yellow Bin (Recyclable)',
        binColor: '#eab308'
    },
    'ThuyTinh': {
        class: 'badge-indigo',
        nameVi: 'Thủy tinh',
        nameEn: 'Glass',
        binVi: 'Thùng Vàng (Tái chế)',
        binEn: 'Yellow Bin (Recyclable)',
        binColor: '#eab308'
    },
    'Vai': {
        class: 'badge-purple',
        nameVi: 'Vải/Quần áo',
        nameEn: 'Fabric/Clothing',
        binVi: 'Thùng Đỏ (Rác khác)',
        binEn: 'Red Bin (Other Waste)',
        binColor: '#ef4444'
    }
};

// Từ điển dịch thuật cho thông tin chẩn đoán, trạng thái và lỗi của giao diện
const translations = {
    en: {
        'error_camera': 'Unable to connect to camera',
        'error_processing': 'Error processing image',
        'error_select_file': 'Please select an image file',
        'no_results': 'No detection data yet',
        'no_data': 'No detailed metrics available',
        'Giay': 'Paper',
        'KimLoai': 'Metal',
        'Nhua': 'Plastic',
        'ThuyTinh': 'Glass',
        'Vai': 'Fabric',
        'None': 'None'
    },
    vi: {
        'error_camera': 'Không thể kết nối với camera',
        'error_processing': 'Lỗi khi xử lý ảnh',
        'error_select_file': 'Vui lòng chọn một file ảnh',
        'no_results': 'Chưa có dữ liệu nhận diện',
        'no_data': 'Không có dữ liệu chi tiết',
        'Giay': 'Giấy',
        'KimLoai': 'Kim loại',
        'Nhua': 'Nhựa',
        'ThuyTinh': 'Thủy tinh',
        'Vai': 'Vải',
        'None': 'Không có'
    }
};