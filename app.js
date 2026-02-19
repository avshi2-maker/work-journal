// ============================================
// STONHARD WORK JOURNAL - APPLICATION
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://vmcipofovheztbjmhwsl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzOTE0NzQsImV4cCI6MjA1NTk2NzQ3NH0.sb_publishable_bwS1W5RsvS-KSaGkRop7kg_xJqUDcuH';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global State
let currentReport = null;
let signaturePad = null;
let ownerSignaturePad = null;
let selectedPhotos = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if viewing a report (owner view) or creating one (manager view)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        // Owner view - load report
        loadReportForOwner(token);
    } else {
        // Manager view - initialize form
        initializeManagerView();
    }
});

// ============================================
// MANAGER VIEW
// ============================================

function initializeManagerView() {
    document.getElementById('managerView').style.display = 'block';
    document.getElementById('ownerView').style.display = 'none';
    
    // Set default date
    document.getElementById('reportDate').valueAsDate = new Date();
    
    // Initialize signature pad
    initSignaturePad('signatureCanvas');
    
    // Add initial rows
    addWorkerRow();
    addActivityRow();
    
    // Photo handler
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelection);
    
    // Button handlers
    document.getElementById('saveBtn').addEventListener('click', saveDraft);
    document.getElementById('sendBtn').addEventListener('click', sendReport);
}

// ============================================
// SIGNATURE PAD
// ============================================

function initSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
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
    
    canvas.addEventListener('mousedown', (e) => {
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    });
    
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseout', () => drawing = false);
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    });
    
    canvas.addEventListener('touchmove', (e) => {
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
    });
    
    canvas.addEventListener('touchend', () => drawing = false);
    
    if (canvasId === 'signatureCanvas') {
        signaturePad = canvas;
    } else {
        ownerSignaturePad = canvas;
    }
}

function clearSignature() {
    const ctx = signaturePad.getContext('2d');
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
}

function clearOwnerSignature() {
    const ctx = ownerSignaturePad.getContext('2d');
    ctx.clearRect(0, 0, ownerSignaturePad.width, ownerSignaturePad.height);
}

// ============================================
// DYNAMIC ROWS
// ============================================

function addWorkerRow() {
    const container = document.getElementById('workersContainer');
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תפקיד" class="worker-role">
        <input type="number" placeholder="מספר" class="worker-count">
        <input type="number" placeholder="שעות" step="0.5" class="worker-hours">
    `;
    container.appendChild(row);
}

function addActivityRow() {
    const container = document.getElementById('activitiesContainer');
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
// PHOTO HANDLING
// ============================================

function handlePhotoSelection(e) {
    const files = Array.from(e.target.files);
    selectedPhotos = [...selectedPhotos, ...files];
    displayPhotoPreview();
}

function displayPhotoPreview() {
    const preview = document.getElementById('photoPreview');
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
// COLLECT FORM DATA
// ============================================

function collectFormData() {
    // Workers
    const workers = [];
    document.querySelectorAll('#workersContainer .form-row').forEach(row => {
        const role = row.querySelector('.worker-role').value;
        const count = row.querySelector('.worker-count').value;
        const hours = row.querySelector('.worker-hours').value;
        if (role) {
            workers.push({ role, worker_count: parseInt(count) || 0, hours_worked: parseFloat(hours) || 0 });
        }
    });
    
    // Activities
    const activities = [];
    document.querySelectorAll('#activitiesContainer .form-row').forEach(row => {
        const desc = row.querySelector('.activity-desc').value;
        const location = row.querySelector('.activity-location').value;
        const quantity = row.querySelector('.activity-quantity').value;
        if (desc) {
            activities.push({ description: desc, location, quantity });
        }
    });
    
    return {
        project_name: document.getElementById('projectName').value,
        report_date: document.getElementById('reportDate').value,
        manager_name: 'אבשי ספיר',
        weather: document.getElementById('weather').value,
        start_time: document.getElementById('startTime').value,
        end_time: document.getElementById('endTime').value,
        break_hours: parseFloat(document.getElementById('breakHours').value) || 0,
        general_notes: document.getElementById('generalNotes').value,
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
        
        // Upload signature
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        // Insert report
        const { data: report, error } = await supabase
            .from('reports')
            .insert({
                ...data,
                manager_signature_path: signaturePath,
                status: 'draft'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Insert workers
        if (data.workers.length > 0) {
            await supabase.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        // Insert activities
        if (data.activities.length > 0) {
            await supabase.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        // Upload photos
        await uploadPhotos(report.id);
        
        alert('✅ טיוטה נשמרה!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה בשמירה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function sendReport() {
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        // Upload signature
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        // Insert report
        const { data: report, error } = await supabase
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
        
        // Insert workers
        if (data.workers.length > 0) {
            await supabase.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        // Insert activities
        if (data.activities.length > 0) {
            await supabase.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        // Upload photos
        await uploadPhotos(report.id);
        
        // Generate short URL
        const shareURL = `${window.location.origin}${window.location.pathname}?token=${report.share_token}`;
        
        // Open WhatsApp
        const message = `🔒 *דוח עבודה יומי מאובטח*\n\n` +
            `👷 *מנהל פרויקט:* אבשי ספיר\n` +
            `🏗️ *פרוייקט:* ${data.project_name}\n` +
            `📅 *תאריך:* ${data.report_date}\n\n` +
            `✅ *לחץ לאישור:*\n${shareURL}\n\n` +
            `📱 050-5231042`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
        
        alert('✅ דוח נשלח!\n\nקישור: ' + shareURL);
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה בשליחה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

async function uploadSignature(canvas, type) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const fileName = `${type}_${Date.now()}.png`;
    
    const { data, error } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob);
    
    if (error) throw error;
    return data.path;
}

async function uploadPhotos(reportId) {
    for (let i = 0; i < selectedPhotos.length; i++) {
        const file = selectedPhotos[i];
        const fileName = `${reportId}_${Date.now()}_${i}.jpg`;
        
        const { data, error } = await supabase.storage
            .from('photos')
            .upload(fileName, file);
        
        if (error) throw error;
        
        await supabase.from('photos').insert({
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
        // Load report using helper function
        const { data, error } = await supabase.rpc('get_full_report', {
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
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה בטעינת הדוח: ' + error.message);
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
    if (report.general_notes) {
        html += `<p><strong>הערות:</strong> ${report.general_notes}</p>`;
    }
    html += '</div>';
    
    container.innerHTML = html;
}

async function approveReport() {
    const ownerName = document.getElementById('ownerName').value;
    const remarks = document.getElementById('ownerRemarks').value;
    
    if (!ownerName) {
        alert('❌ נא למלא את שמך');
        return;
    }
    
    showLoading(true);
    
    try {
        // Upload owner signature
        const signaturePath = await uploadSignature(ownerSignaturePad, 'owner');
        
        // Update report
        await supabase
            .from('reports')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                owner_signature_path: signaturePath
            })
            .eq('id', currentReport.report.id);
        
        // Insert approval record
        await supabase.from('approvals').insert({
            report_id: currentReport.report.id,
            owner_name: ownerName,
            remarks: remarks,
            signature_path: signaturePath
        });
        
        alert('✅ דוח אושר בהצלחה!');
        
        // Send confirmation via WhatsApp
        const message = `✅ *דוח אושר*\n\n` +
            `🏗️ ${currentReport.report.project_name}\n` +
            `👤 אושר ע"י: ${ownerName}\n` +
            `📅 ${currentReport.report.report_date}`;
        
        window.open(`https://wa.me/972505231042?text=${encodeURIComponent(message)}`);
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ שגיאה באישור: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
