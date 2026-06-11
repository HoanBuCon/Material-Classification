document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('theme-toggle');
    const languageToggle = document.getElementById('language-toggle');
    const langText = document.getElementById('lang-text');
    
    const startCameraBtn = document.getElementById('start-camera');
    const stopCameraBtn = document.getElementById('stop-camera');
    const uploadFileBtn = document.getElementById('upload-file');
    
    const placeholderContainer = document.getElementById('placeholder-container');
    const cameraContainer = document.getElementById('camera-container');
    const comparisonContainer = document.getElementById('comparison-container');
    
    const originalImage = document.getElementById('original-image');
    const detectedImage = document.getElementById('detected-image');
    const videoFeed = document.getElementById('video-feed');
    const loadingIndicator = document.getElementById("loading-indicator");
    
    const resultsList = document.getElementById('results-list');
    const metricsTableBody = document.getElementById('metrics-table-body');
    const objectCount = document.getElementById('object-count');
    const processingTime = document.getElementById('processing-time');
    
    // Session stats reset button
    const resetStatsBtn = document.getElementById('reset-session-stats');

    // State variables
    let cameraActive = false;
    let detectionInterval = null;
    let currentLanguage = localStorage.getItem('language') || 'vi';
    
    // Session statistics counters
    let sessionCounts = {
        'Giay': parseInt(localStorage.getItem('stat_Giay')) || 0,
        'KimLoai': parseInt(localStorage.getItem('stat_KimLoai')) || 0,
        'Nhua': parseInt(localStorage.getItem('stat_Nhua')) || 0,
        'ThuyTinh': parseInt(localStorage.getItem('stat_ThuyTinh')) || 0,
        'Vai': parseInt(localStorage.getItem('stat_Vai')) || 0
    };
    
    // For smart debouncing camera detections
    let lastFrameCounts = { 'Giay': 0, 'KimLoai': 0, 'Nhua': 0, 'ThuyTinh': 0, 'Vai': 0 };

    // (materialConfig and translations are loaded globally from translations.js)

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeIcon = themeToggle.querySelector('i');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeIcon.className = 'fas fa-sun';
    } else {
        document.body.classList.remove('dark-theme');
        themeIcon.className = 'fas fa-moon';
    }

    themeToggle.addEventListener('click', function() {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.remove('dark-theme');
            themeIcon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark-theme');
            themeIcon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'dark');
        }
    });

    // --- Language Logic ---
    applyLanguage(currentLanguage);
    updateSessionStatsUI();

    languageToggle.addEventListener('click', function() {
        currentLanguage = currentLanguage === 'vi' ? 'en' : 'vi';
        localStorage.setItem('language', currentLanguage);
        applyLanguage(currentLanguage);
        
        // If camera is running, update the stream source to match the selected language
        if (cameraActive) {
            videoFeed.src = `/video_feed?lang=${currentLanguage}`;
        }
        
        // Re-render table and results list to apply new language if there are active detections
        if (lastDetections && lastDetections.length > 0) {
            renderDetections(lastDetections);
        } else {
            clearResults();
        }
    });

    function applyLanguage(lang) {
        langText.textContent = lang === 'vi' ? 'EN' : 'VI';
        
        // Translate elements with class 'lang'
        document.querySelectorAll('.lang').forEach(element => {
            if (element.dataset[lang]) {
                element.textContent = element.dataset[lang];
            }
        });

        // Translate page title
        document.title = lang === 'vi' ? 'Hệ Thống Phân Loại Vật Liệu' : 'Material Classification System';
    }

    function translate(key) {
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            return translations[currentLanguage][key];
        }
        return key;
    }

    // --- Session Stats Logic ---
    function updateSessionStats(objects) {
        // Count frequencies in current frame
        let currentCounts = { 'Giay': 0, 'KimLoai': 0, 'Nhua': 0, 'ThuyTinh': 0, 'Vai': 0 };
        objects.forEach(obj => {
            if (currentCounts[obj.label] !== undefined) {
                currentCounts[obj.label]++;
            }
        });

        // Smart addition: only add the positive differences (debouncing static frames)
        let addedSomething = false;
        for (let key in currentCounts) {
            let diff = currentCounts[key] - lastFrameCounts[key];
            if (diff > 0) {
                sessionCounts[key] += diff;
                localStorage.setItem(`stat_${key}`, sessionCounts[key]);
                addedSomething = true;
            }
        }

        // Save last frame counts
        lastFrameCounts = currentCounts;

        if (addedSomething || objects.length === 0) {
            updateSessionStatsUI();
        }
    }

    function updateSessionStatsUI() {
        let total = 0;
        for (let key in sessionCounts) {
            const el = document.getElementById(`stat-count-${key.toLowerCase()}`);
            if (el) {
                el.textContent = sessionCounts[key];
            }
            total += sessionCounts[key];
        }
        const totalEl = document.getElementById('stat-count-total');
        if (totalEl) {
            totalEl.textContent = total;
        }
    }

    resetStatsBtn.addEventListener('click', function() {
        for (let key in sessionCounts) {
            sessionCounts[key] = 0;
            localStorage.setItem(`stat_${key}`, 0);
            lastFrameCounts[key] = 0;
        }
        updateSessionStatsUI();
    });

    // --- Detections Rendering Logic ---
    let lastDetections = null;

    function renderDetections(objects) {
        // 1. Update list with progress bars
        resultsList.innerHTML = '';
        if (objects.length === 0) {
            const noResultsItem = document.createElement('li');
            noResultsItem.className = 'no-results';
            noResultsItem.textContent = translate('no_results');
            resultsList.appendChild(noResultsItem);
        } else {
            objects.forEach((obj, index) => {
                const item = document.createElement('li');
                if (index === 0) item.className = 'highlight';
                
                const config = materialConfig[obj.label] || { nameVi: obj.label, nameEn: obj.label };
                const displayName = currentLanguage === 'vi' ? config.nameVi : config.nameEn;
                
                item.innerHTML = `
                    <span class="object-label">${displayName}</span>
                    <div class="confidence-bar">
                        <div class="confidence-level" style="width: ${obj.confidence * 100}%"></div>
                    </div>
                    <span class="confidence-value">${(obj.confidence * 100).toFixed(1)}%</span>
                `;
                resultsList.appendChild(item);
            });
        }

        // 2. Update detailed metrics table
        metricsTableBody.innerHTML = '';
        if (objects.length === 0) {
            metricsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">${translate('no_data')}</td>
                </tr>
            `;
        } else {
            objects.forEach((obj, index) => {
                const config = materialConfig[obj.label] || {
                    class: 'badge-gray',
                    nameVi: obj.label,
                    nameEn: obj.label,
                    binVi: 'Không xác định',
                    binEn: 'Unknown',
                    binColor: '#6b7280'
                };
                
                const displayName = currentLanguage === 'vi' ? config.nameVi : config.nameEn;
                const binRecommendation = currentLanguage === 'vi' ? config.binVi : config.binEn;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td><span class="badge ${config.class}">${displayName}</span></td>
                    <td><strong>${(obj.confidence * 100).toFixed(1)}%</strong></td>
                    <td class="coord-cell">x:${obj.position.x}, y:${obj.position.y}, w:${obj.position.width}, h:${obj.position.height}</td>
                    <td class="bin-cell">
                        <span class="bin-indicator" style="background-color: ${config.binColor}"></span>
                        <span>${binRecommendation}</span>
                    </td>
                `;
                metricsTableBody.appendChild(row);
            });
        }
    }

    // --- Camera stream and polling controllers ---
    startCameraBtn.addEventListener('click', function() {
        if (cameraActive) return;
        
        showLoading(true);
        cameraActive = true;
        
        placeholderContainer.classList.add('hidden');
        comparisonContainer.classList.add('hidden');
        cameraContainer.classList.remove('hidden');
        
        videoFeed.src = `/video_feed?lang=${currentLanguage}`;
        
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        
        videoFeed.onload = function() {
            showLoading(false);
            startDetectionPolling();
        };
        
        videoFeed.onerror = function() {
            showError(translate('error_camera'));
            stopCamera();
        };
    });

    stopCameraBtn.addEventListener('click', stopCamera);

    function stopCamera() {
        if (!cameraActive) return;
        
        fetch('/stop_camera')
            .then(response => response.json())
            .then(data => {
                cameraActive = false;
                
                cameraContainer.classList.add('hidden');
                placeholderContainer.classList.remove('hidden');
                
                startCameraBtn.disabled = false;
                stopCameraBtn.disabled = true;
                
                if (detectionInterval) {
                    clearInterval(detectionInterval);
                    detectionInterval = null;
                }
                
                clearResults();
            })
            .catch(error => {
                console.error("Lỗi khi dừng camera:", error);
            });
    }

    function startDetectionPolling() {
        if (detectionInterval) {
            clearInterval(detectionInterval);
        }
        
        // Poll frame detection data every 1 second
        detectionInterval = setInterval(() => {
            if (!cameraActive) {
                clearInterval(detectionInterval);
                detectionInterval = null;
                return;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = videoFeed.naturalWidth || 640;
            canvas.height = videoFeed.naturalHeight || 480;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(blob => {
                if (!blob || !cameraActive) return;
                
                const formData = new FormData();
                formData.append('file', blob, 'snapshot.jpg');
                
                const startTime = performance.now();
                
                fetch(`/upload?lang=${currentLanguage}`, {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (!cameraActive) return;
                    const endTime = performance.now();
                    const processingTimeMs = endTime - startTime;
                    
                    lastDetections = data.objects;
                    objectCount.textContent = data.objects.length;
                    if (processingTime) {
                        processingTime.textContent = `${processingTimeMs.toFixed(0)} ms`;
                    }
                    
                    renderDetections(data.objects);
                    updateSessionStats(data.objects);
                })
                .catch(error => {
                    console.error("Lỗi khi nhận dạng camera frame:", error);
                });
                
            }, 'image/jpeg', 0.85);
            
        }, 1000);
    }

    // --- Upload file controller ---
    uploadFileBtn.addEventListener('change', function(e) {
        if (e.target.files.length === 0) return;
        
        if (cameraActive) {
            stopCamera();
        }
        
        const file = e.target.files[0];
        if (!file.type.match('image.*')) {
            alert(translate('error_select_file'));
            return;
        }
        
        showLoading(true);
        
        // Display original image
        const reader = new FileReader();
        reader.onload = function(event) {
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        const formData = new FormData();
        formData.append('file', file);
        
        const startTime = performance.now();
        
        fetch(`/upload?lang=${currentLanguage}`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response error');
            return response.json();
        })
        .then(data => {
            const endTime = performance.now();
            const processingTimeMs = endTime - startTime;
            
            placeholderContainer.classList.add('hidden');
            cameraContainer.classList.add('hidden');
            comparisonContainer.classList.remove('hidden');
            
            detectedImage.src = data.image;
            
            lastDetections = data.objects;
            objectCount.textContent = data.objects.length;
            if (processingTime) {
                processingTime.textContent = `${processingTimeMs.toFixed(0)} ms`;
            }
            
            // Clear last frame counts to force full count addition on single uploaded image
            for (let k in lastFrameCounts) {
                lastFrameCounts[k] = 0;
            }
            
            renderDetections(data.objects);
            updateSessionStats(data.objects);
            
            uploadFileBtn.value = '';
        })
        .catch(error => {
            console.error('Lỗi upload:', error);
            showError(translate('error_processing'));
        })
        .finally(() => {
            showLoading(false);
        });
    });

    // --- Utility UI Functions ---
    function showLoading(show) {
        if (show) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }

    function showError(message) {
        clearResults();
        
        resultsList.innerHTML = '';
        const errorItem = document.createElement('li');
        errorItem.className = 'no-results';
        errorItem.style.color = 'var(--danger)';
        errorItem.textContent = message;
        resultsList.appendChild(errorItem);
        
        metricsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data" style="color: var(--danger)">${message}</td>
            </tr>
        `;
    }

    function clearResults() {
        lastDetections = null;
        for (let k in lastFrameCounts) {
            lastFrameCounts[k] = 0;
        }
        
        resultsList.innerHTML = '';
        const noResultsItem = document.createElement('li');
        noResultsItem.className = 'no-results';
        noResultsItem.textContent = translate('no_results');
        resultsList.appendChild(noResultsItem);
        
        metricsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">${translate('no_data')}</td>
            </tr>
        `;
        
        objectCount.textContent = '0';
        if (processingTime) {
            processingTime.textContent = '0 ms';
        }
    }

    // Set dynamic year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    // Initialize UI on startup
    clearResults();
});