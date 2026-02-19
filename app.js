// ============================================
// STONHARD WORK JOURNAL - ENHANCED VERSION
// Owner Photos + Voice Input + Print
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://vmcipofovheztbjmhwsl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NzQxMDQsImV4cCI6MjA1NjM1MDEwNH0.sb_publishable_bwS1W5RsvS-KSaGkRop7kg_xJqUDcuH';

// Initialize Supabase
let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized');
} catch (error) {
    console.error('❌ Supabase error:', error);
}

// Global State
let currentReport = null;
let signaturePad = null;
let ownerSignaturePad = null;
let selectedPhotos = [];
let selectedOwnerPhotos = [];
let voiceRecognition = null;
let currentVoiceTarget = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        loadReportForOwner(token);
    } else {
        initializeManagerView();
    }
    
    // Initialize voice recognition
    initializeVoiceRecognition();
});

// ============================================
// MANAGER VIEW
// ============================================

function initializeManagerView() {
    console.log('Initializing manager view...');
    
    document.getElementById('managerView').style.display = 'block';
    document.getElementById('ownerView').style.display = 'none';
    
    // Set default dates
    const today = new Date();
    document.getElementById('reportDate').valueAsDate = today;
    
    // Set tomorrow's date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tomorrowDate').valueAsDate = tomorrow;
    
    // Initialize signature
    initSignaturePad('signatureCanvas');
    
    // Add initial rows
    addWorkerRow();
    addActivityRow();
    
    // Photo handlers
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelection);
    
    // Button handlers
    document.getElementById('saveBtn').addEventListener('click', saveDraft);
    document.getElementById('sendBtn').addEventListener('click', sendReport);
    
    // Voice button handlers
    document.getElementById('voiceNotesBtn').addEventListener('click', () => {
        startVoiceRecording('generalNotes');
    });
    
    document.getElementById('voiceTomorrowBtn').addEventListener('click', () => {
        startVoiceRecording('tomorrowPlan');
    });
    
    // Auto-calculate work hours
    document.getElementById('startTime').addEventListener('change', calculateWorkHours);
    document.getElementById('endTime').addEventListener('change', calculateWorkHours);
    document.getElementById('breakHours').addEventListener('input', calculateWorkHours);
    
    console.log('✅ Manager view ready');
}

// ============================================
// AUTO-CALCULATIONS
// ============================================

function calculateWorkHours() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakHours = parseFloat(document.getElementById('breakHours').value) || 0;
    
    if (!startTime || !endTime) {
        document.getElementById('totalWorkHours').textContent = '0';
        return;
    }
    
    // Parse times
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Calculate total minutes
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    // Handle overnight shifts
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    
    // Convert to hours and subtract breaks
    const totalHours = (totalMinutes / 60) - breakHours;
    
    // Update display
    document.getElementById('totalWorkHours').textContent = totalHours.toFixed(1);
}

function calculateTotalWorkerHours() {
    let total = 0;
    
    document.querySelectorAll('#workersContainer .form-row').forEach(row => {
        const count = parseInt(row.querySelector('.worker-count').value) || 0;
        const hours = parseFloat(row.querySelector('.worker-hours').value) || 0;
        total += count * hours;
    });
    
    document.getElementById('totalWorkerHours').textContent = total.toFixed(1);
}

// ============================================
// VOICE RECOGNITION
// ============================================

function initializeVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        
        voiceRecognition.lang = 'he-IL'; // Hebrew
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;
        
        voiceRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (currentVoiceTarget && finalTranscript) {
                const textarea = document.getElementById(currentVoiceTarget);
                textarea.value += finalTranscript;
            }
        };
        
        voiceRecognition.onerror = (event) => {
            console.error('Voice error:', event.error);
            stopVoiceRecording();
            if (event.error === 'no-speech') {
                alert('לא זוהה דיבור. נסה שוב.');
            }
        };
        
        voiceRecognition.onend = () => {
            stopVoiceRecording();
        };
        
        console.log('✅ Voice recognition ready');
    } else {
        console.warn('⚠️ Voice recognition not supported');
    }
}

function startVoiceRecording(targetId) {
    if (!voiceRecognition) {
        alert('הקלטה קולית לא נתמכת בדפדפן זה');
        return;
    }
    
    currentVoiceTarget = targetId;
    
    // Show indicator
    document.getElementById('voiceIndicator').style.display = 'flex';
    
    // Start recognition
    try {
        voiceRecognition.start();
        console.log('🎤 Recording started');
    } catch (error) {
        console.error('Start error:', error);
        stopVoiceRecording();
    }
}

function stopVoiceRecording() {
    if (voiceRecognition) {
        try {
            voiceRecognition.stop();
        } catch (error) {
            console.error('Stop error:', error);
        }
    }
    
    document.getElementById('voiceIndicator').style.display = 'none';
    currentVoiceTarget = null;
    console.log('⏹️ Recording stopped');
}

// ============================================
// SIGNATURE PAD
// ============================================

function initSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 100;
    
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
    }
    
    function startDrawing(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    }
    
    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    }
    
    function stopDrawing() {
        drawing = false;
    }
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    if (canvasId === 'signatureCanvas') {
        signaturePad = canvas;
    } else {
        ownerSignaturePad = canvas;
    }
}

function clearSignature() {
    if (!signaturePad) return;
    const ctx = signaturePad.getContext('2d');
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
}

function clearOwnerSignature() {
    if (!ownerSignaturePad) return;
    const ctx = ownerSignaturePad.getContext('2d');
    ctx.clearRect(0, 0, ownerSignaturePad.width, ownerSignaturePad.height);
}

// ============================================
// DYNAMIC ROWS
// ============================================

function addWorkerRow() {
    const container = document.getElementById('workersContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תפקיד" class="worker-role">
        <input type="number" placeholder="מספר" class="worker-count" value="1">
        <input type="number" placeholder="שעות" step="0.5" class="worker-hours" value="8">
    `;
    container.appendChild(row);
    
    // Add event listeners for auto-calculation
    row.querySelector('.worker-count').addEventListener('input', calculateTotalWorkerHours);
    row.querySelector('.worker-hours').addEventListener('input', calculateTotalWorkerHours);
    
    // Calculate initial total
    calculateTotalWorkerHours();
}

function addActivityRow() {
    const container = document.getElementById('activitiesContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תיאור" class="activity-desc">
        <input type="text" placeholder="מיקום" class="activity-location">
        <input type="text" placeholder="כמות" class="activity-quantity">
    `;
    container.appendChild(row);
}

// ============================================
// PHOTO HANDLING - MANAGER
// ============================================

function handlePhotoSelection(e) {
    const files = Array.from(e.target.files);
    selectedPhotos = [...selectedPhotos, ...files];
    displayPhotoPreview();
}

function displayPhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    selectedPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Photo">
                <button class="remove-photo" onclick="removePhoto(${index})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    displayPhotoPreview();
}

// ============================================
// PHOTO HANDLING - OWNER
// ============================================

function handleOwnerPhotoSelection(e) {
    const files = Array.from(e.target.files);
    selectedOwnerPhotos = [...selectedOwnerPhotos, ...files];
    displayOwnerPhotoPreview();
}

function displayOwnerPhotoPreview() {
    const preview = document.getElementById('ownerPhotoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    selectedOwnerPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Owner Photo">
                <button class="remove-photo" onclick="removeOwnerPhoto(${index})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeOwnerPhoto(index) {
    selectedOwnerPhotos.splice(index, 1);
    displayOwnerPhotoPreview();
}

// ============================================
// COLLECT FORM DATA
// ============================================

function collectFormData() {
    const workers = [];
    document.querySelectorAll('#workersContainer .form-row').forEach(row => {
        const role = row.querySelector('.worker-role').value;
        const count = row.querySelector('.worker-count').value;
        const hours = row.querySelector('.worker-hours').value;
        if (role) {
            workers.push({ 
                role, 
                worker_count: parseInt(count) || 0, 
                hours_worked: parseFloat(hours) || 0 
            });
        }
    });
    
    const activities = [];
    document.querySelectorAll('#activitiesContainer .form-row').forEach(row => {
        const desc = row.querySelector('.activity-desc').value;
        const location = row.querySelector('.activity-location').value;
        const quantity = row.querySelector('.activity-quantity').value;
        if (desc) {
            activities.push({ description: desc, location, quantity });
        }
    });
    
    // Calculate total work hours
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakHours = parseFloat(document.getElementById('breakHours').value) || 0;
    let totalWorkHours = 0;
    
    if (startTime && endTime) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        totalWorkHours = (totalMinutes / 60) - breakHours;
    }
    
    return {
        project_name: document.getElementById('projectName').value || 'ללא שם',
        report_date: document.getElementById('reportDate').value,
        manager_name: 'אבשי ספיר',
        weather: document.getElementById('weather').value,
        start_time: startTime || null,
        end_time: endTime || null,
        break_hours: breakHours,
        total_work_hours: totalWorkHours,
        general_notes: document.getElementById('generalNotes').value,
        tomorrow_date: document.getElementById('tomorrowDate').value,
        tomorrow_plan: document.getElementById('tomorrowPlan').value,
        workers,
        activities
    };
}

// ============================================
// SAVE FUNCTIONS
// ============================================

async function saveDraft() {
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        if (!data.project_name) {
            alert('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        const { data: report, error } = await supabaseClient
            .from('reports')
            .insert({
                ...data,
                manager_signature_path: signaturePath,
                status: 'draft'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        if (data.workers.length > 0) {
            await supabaseClient.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        if (data.activities.length > 0) {
            await supabaseClient.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        await uploadPhotos(report.id, selectedPhotos, 'manager');
        
        alert('✅ טיוטה נשמרה!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function sendReport() {
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        if (!data.project_name) {
            alert('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        const { data: report, error } = await supabaseClient
            .from('reports')
            .insert({
                ...data,
                manager_signature_path: signaturePath,
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        if (data.workers.length > 0) {
            await supabaseClient.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        if (data.activities.length > 0) {
            await supabaseClient.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        await uploadPhotos(report.id, selectedPhotos, 'manager');
        
        const shareURL = `${window.location.origin}${window.location.pathname}?token=${report.share_token}`;
        
        const message = `🔒 *דוח עבודה יומי מאובטח*\n\n` +
            `👷 *מנהל:* אבשי ספיר\n` +
            `🏗️ *פרוייקט:* ${data.project_name}\n` +
            `📅 *תאריך:* ${data.report_date}\n\n` +
            `✅ *לחץ לאישור:*\n${shareURL}\n\n` +
            `📱 050-5231042`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
        
        alert('✅ דוח נשלח!\n\nקישור: ' + shareURL);
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

async function uploadSignature(canvas, type) {
    if (!canvas) return null;
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const fileName = `${type}_${Date.now()}.png`;
    
    const { data, error } = await supabaseClient.storage
        .from('signatures')
        .upload(fileName, blob);
    
    if (error) throw error;
    return data.path;
}

async function uploadPhotos(reportId, photos, uploadedBy) {
    for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const fileName = `${reportId}_${uploadedBy}_${Date.now()}_${i}.jpg`;
        
        const { data, error } = await supabaseClient.storage
            .from('photos')
            .upload(fileName, file);
        
        if (error) throw error;
        
        await supabaseClient.from('photos').insert({
            report_id: reportId,
            storage_path: data.path,
            file_size: file.size
        });
    }
}

// ============================================
// OWNER VIEW
// ============================================

async function loadReportForOwner(token) {
    showLoading(true);
    
    try {
        const { data, error } = await supabaseClient.rpc('get_full_report', {
            report_token: token
        });
        
        if (error) throw error;
        
        if (!data || !data.report) {
            alert('❌ דוח לא נמצא');
            return;
        }
        
        currentReport = data;
        displayReportForOwner(data);
        
        document.getElementById('managerView').style.display = 'none';
        document.getElementById('ownerView').style.display = 'block';
        
        initSignaturePad('ownerSignature');
        
        // Owner photo handler
        document.getElementById('ownerPhotoInput').addEventListener('change', handleOwnerPhotoSelection);
        
        // Voice button for owner remarks
        document.getElementById('voiceRemarksBtn').addEventListener('click', () => {
            startVoiceRecording('ownerRemarks');
        });
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function displayReportForOwner(data) {
    const report = data.report;
    const container = document.getElementById('reportDetails');
    
    let html = '<div class="section">';
    html += `<h2>📋 ${report.project_name}</h2>`;
    html += `<p><strong>תאריך:</strong> ${report.report_date}</p>`;
    html += `<p><strong>מנהל:</strong> ${report.manager_name}</p>`;
    if (report.weather) html += `<p><strong>מזג אוויר:</strong> ${report.weather}</p>`;
    
    // Work hours
    if (report.start_time && report.end_time) {
        html += `<p><strong>שעות עבודה:</strong> ${report.start_time} - ${report.end_time}`;
        if (report.total_work_hours) {
            html += ` (סה"כ: ${report.total_work_hours} שעות)`;
        }
        html += '</p>';
    }
    
    // Notes
    if (report.general_notes) html += `<p><strong>הערות:</strong> ${report.general_notes}</p>`;
    
    // Tomorrow's plan
    if (report.tomorrow_plan) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📅 תוכנית עבודה למחר</h3>';
        if (report.tomorrow_date) {
            html += `<p><strong>תאריך:</strong> ${report.tomorrow_date}</p>`;
        }
        html += `<p>${report.tomorrow_plan}</p>`;
    }
    
    // Workers
    if (data.workers && data.workers.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>👷 כוח אדם</h3>';
        let totalWorkerHours = 0;
        data.workers.forEach(worker => {
            html += `<p>• ${worker.role}: ${worker.worker_count} עובדים × ${worker.hours_worked} שעות</p>`;
            totalWorkerHours += worker.worker_count * worker.hours_worked;
        });
        html += `<p><strong>סה"כ שעות כוח אדם:</strong> ${totalWorkerHours} שעות</p>`;
    }
    
    // Activities
    if (data.activities && data.activities.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>🔨 פעילויות</h3>';
        data.activities.forEach(activity => {
            html += `<p>• ${activity.description}`;
            if (activity.location) html += ` - ${activity.location}`;
            if (activity.quantity) html += ` (${activity.quantity})`;
            html += '</p>';
        });
    }
    
    // Show manager photos if any
    if (data.photos && data.photos.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📸 תמונות מהאתר</h3>';
        html += '<div class="photo-preview">';
        data.photos.forEach(photo => {
            const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`;
            html += `<div class="photo-item"><img src="${photoUrl}" alt="Site photo"></div>`;
        });
        html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function approveReport() {
    const ownerName = document.getElementById('ownerName').value;
    const remarks = document.getElementById('ownerRemarks').value;
    
    if (!ownerName) {
        alert('❌ נא למלא שם');
        return;
    }
    
    showLoading(true);
    
    try {
        const signaturePath = await uploadSignature(ownerSignaturePad, 'owner');
        
        // Upload owner photos if any
        if (selectedOwnerPhotos.length > 0) {
            await uploadPhotos(currentReport.report.id, selectedOwnerPhotos, 'owner');
        }
        
        await supabaseClient
            .from('reports')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                owner_signature_path: signaturePath
            })
            .eq('id', currentReport.report.id);
        
        await supabaseClient.from('approvals').insert({
            report_id: currentReport.report.id,
            owner_name: ownerName,
            remarks: remarks,
            signature_path: signaturePath
        });
        
        alert('✅ דוח אושר!');
        
        const message = `✅ *דוח אושר*\n\n` +
            `🏗️ ${currentReport.report.project_name}\n` +
            `👤 ${ownerName}\n` +
            `📅 ${currentReport.report.report_date}` +
            (selectedOwnerPhotos.length > 0 ? `\n📸 ${selectedOwnerPhotos.length} תמונות נוספו` : '');
        
        window.open(`https://wa.me/972505231042?text=${encodeURIComponent(message)}`);
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// PRINT FUNCTION
// ============================================

function printReport() {
    window.print();
}

// ============================================
// UTILITY
// ============================================

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

console.log('✅ App loaded with all features');
