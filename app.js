// ============================================
// STONHARD WORK JOURNAL - APPLICATION (FIXED)
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://vmcipofovheztbjmhwsl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NzQxMDQsImV4cCI6MjA1NjM1MDEwNH0.sb_publishable_bwS1W5RsvS-KSaGkRop7kg_xJqUDcuH';

// Initialize Supabase client
let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized successfully');
} catch (error) {
    console.error('Supabase initialization error:', error);
}

// Global State
let currentReport = null;
let signaturePad = null;
let ownerSignaturePad = null;
let selectedPhotos = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    
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
    console.log('Initializing manager view...');
    
    document.getElementById('managerView').style.display = 'block';
    document.getElementById('ownerView').style.display = 'none';
    
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;
    
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
    
    console.log('Manager view initialized');
}

// ============================================
// SIGNATURE PAD
// ============================================

function initSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas not found:', canvasId);
        return;
    }
    
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
    console.log('Adding worker row');
    const container = document.getElementById('workersContainer');
    if (!container) {
        console.error('Workers container not found');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תפקיד" class="worker-role">
        <input type="number" placeholder="מספר" class="worker-count" value="1">
        <input type="number" placeholder="שעות" step="0.5" class="worker-hours" value="8">
    `;
    container.appendChild(row);
}

function addActivityRow() {
    console.log('Adding activity row');
    const container = document.getElementById('activitiesContainer');
    if (!container) {
        console.error('Activities container not found');
        return;
    }
    
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
    console.log('Photos selected');
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
// COLLECT FORM DATA
// ============================================

function collectFormData() {
    // Workers
    const workers = [];
    const workerRows = document.querySelectorAll('#workersContainer .form-row');
    workerRows.forEach(row => {
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
    
    // Activities
    const activities = [];
    const activityRows = document.querySelectorAll('#activitiesContainer .form-row');
    activityRows.forEach(row => {
        const desc = row.querySelector('.activity-desc').value;
        const location = row.querySelector('.activity-location').value;
        const quantity = row.querySelector('.activity-quantity').value;
        if (desc) {
            activities.push({ description: desc, location, quantity });
        }
    });
    
    return {
        project_name: document.getElementById('projectName').value || 'ללא שם',
        report_date: document.getElementById('reportDate').value,
        manager_name: 'אבשי ספיר',
        weather: document.getElementById('weather').value,
        start_time: document.getElementById('startTime').value || null,
        end_time: document.getElementById('endTime').value || null,
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
    console.log('Saving draft...');
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        // Validate
        if (!data.project_name) {
            alert('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        // Upload signature
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        // Insert report
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
        
        console.log('Report saved:', report);
        
        // Insert workers
        if (data.workers.length > 0) {
            await supabaseClient.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        // Insert activities
        if (data.activities.length > 0) {
            await supabaseClient.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        // Upload photos
        await uploadPhotos(report.id);
        
        alert('✅ טיוטה נשמרה!');
        
    } catch (error) {
        console.error('Save error:', error);
        alert('❌ שגיאה בשמירה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function sendReport() {
    console.log('Sending report...');
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        // Validate
        if (!data.project_name) {
            alert('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        // Upload signature
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        // Insert report
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
        
        console.log('Report sent:', report);
        
        // Insert workers
        if (data.workers.length > 0) {
            await supabaseClient.from('workers').insert(
                data.workers.map(w => ({ ...w, report_id: report.id }))
            );
        }
        
        // Insert activities
        if (data.activities.length > 0) {
            await supabaseClient.from('activities').insert(
                data.activities.map(a => ({ ...a, report_id: report.id }))
            );
        }
        
        // Upload photos
        await uploadPhotos(report.id);
        
        // Generate short URL
        const shareURL = `${window.location.origin}${window.location.pathname}?token=${report.share_token}`;
        
        console.log('Share URL:', shareURL);
        
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
        console.error('Send error:', error);
        alert('❌ שגיאה בשליחה: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

async function uploadSignature(canvas, type) {
    if (!canvas) {
        console.log('No signature to upload');
        return null;
    }
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const fileName = `${type}_${Date.now()}.png`;
    
    const { data, error } = await supabaseClient.storage
        .from('signatures')
        .upload(fileName, blob);
    
    if (error) throw error;
    return data.path;
}

async function uploadPhotos(reportId) {
    for (let i = 0; i < selectedPhotos.length; i++) {
        const file = selectedPhotos[i];
        const fileName = `${reportId}_${Date.now()}_${i}.jpg`;
        
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
        // Load report using helper function
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
        
    } catch (error) {
        console.error('Load error:', error);
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
        await supabaseClient
            .from('reports')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                owner_signature_path: signaturePath
            })
            .eq('id', currentReport.report.id);
        
        // Insert approval record
        await supabaseClient.from('approvals').insert({
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
        console.error('Approve error:', error);
        alert('❌ שגיאה באישור: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

console.log('App.js loaded successfully');
