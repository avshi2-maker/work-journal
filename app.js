// ============================================
// STONHARD WORK JOURNAL - FULL LEGAL COMPLIANCE
// Israeli Construction Regulations Support
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://vmcipofovheztbjmhwsl.supabase.co';
const 

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
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tomorrowDate').valueAsDate = tomorrow;
    
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
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    
    const totalHours = (totalMinutes / 60) - breakHours;
    
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
        
        voiceRecognition.lang = 'he-IL';
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;
        voiceRecognition.maxAlternatives = 1;
        
        voiceRecognition.onstart = () => {
            console.log('🎤 Voice started - speak now!');
        };
        
        voiceRecognition.onresult = (event) => {
            console.log('📝 Got voice result');
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                console.log('Transcript:', transcript, 'Final:', event.results[i].isFinal);
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                }
            }
            
            if (currentVoiceTarget && finalTranscript) {
                console.log('✅ Adding text:', finalTranscript);
                const textarea = document.getElementById(currentVoiceTarget);
                if (textarea) {
                    textarea.value += finalTranscript;
                    console.log('✅ Text added to:', currentVoiceTarget);
                }
            }
        };
        
        voiceRecognition.onerror = (event) => {
            console.error('❌ Voice error:', event.error);
            
            if (event.error === 'no-speech') {
                alert('לא זוהה דיבור. נסה שוב ודבר בבירור.');
            } else if (event.error === 'not-allowed') {
                alert('נא לאשר גישה למיקרופון בהגדרות הדפדפן.');
            } else if (event.error !== 'aborted') {
                alert('שגיאה בהקלטה: ' + event.error);
            }
            
            stopVoiceRecording();
        };
        
        voiceRecognition.onend = () => {
            console.log('🎤 Voice ended');
            setTimeout(() => {
                if (document.getElementById('voiceIndicator').style.display === 'flex') {
                    try {
                        console.log('🔄 Restarting recognition...');
                        voiceRecognition.start();
                    } catch (error) {
                        console.log('⏹️ Recognition stopped');
                        stopVoiceRecording();
                    }
                }
            }, 100);
        };
        
        console.log('✅ Voice recognition ready');
    } else {
        console.warn('⚠️ Voice recognition not supported');
        alert('הקלטה קולית לא נתמכת בדפדפן זה. השתמש ב-Chrome.');
    }
}

function startVoiceRecording(targetId) {
    if (!voiceRecognition) {
        alert('הקלטה קולית לא נתמכת בדפדפן זה');
        return;
    }
    
    currentVoiceTarget = targetId;
    
    document.getElementById('voiceIndicator').style.display = 'flex';
    
    try {
        voiceRecognition.start();
        console.log('🎤 Recording started');
    } catch (error) {
        console.error('Start error:', error);
        stopVoiceRecording();
    }
}

function stopVoiceRecording() {
    console.log('⏹️ Stopping recording...');
    
    if (voiceRecognition) {
        try {
            voiceRecognition.stop();
        } catch (error) {
            console.error('Stop error:', error);
        }
    }
    
    document.getElementById('voiceIndicator').style.display = 'none';
    
    setTimeout(() => {
        currentVoiceTarget = null;
        console.log('✅ Recording stopped completely');
    }, 1000);
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
// DYNAMIC ROWS - BASIC SECTIONS
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
    
    row.querySelector('.worker-count').addEventListener('input', calculateTotalWorkerHours);
    row.querySelector('.worker-hours').addEventListener('input', calculateTotalWorkerHours);
    
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
// DYNAMIC ROWS - LEGAL SECTIONS
// ============================================

function addMaterialRow() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row four-col">
            <input type="text" placeholder="סוג חומר" class="material-type" required>
            <input type="text" placeholder="כמות" class="material-quantity" required>
            <input type="text" placeholder="יחידה (ק״ג, מ״ר, יח׳)" class="material-unit">
            <input type="text" placeholder="ספק" class="material-supplier">
        </div>
        <input type="datetime-local" class="material-delivery-time" title="מועד אספקה">
    `;
    container.appendChild(row);
}

function addEquipmentRow() {
    const container = document.getElementById('equipmentContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <input type="text" placeholder="סוג ציוד/מכונה" class="equipment-type" required>
            <input type="number" placeholder="שעות שימוש" step="0.5" class="equipment-hours">
            <select class="equipment-rental">
                <option value="false">בבעלות</option>
                <option value="true">השכרה</option>
            </select>
        </div>
        <textarea placeholder="תקלות/בעיות (אופציונלי)" class="equipment-issues" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addSafetyRow() {
    const container = document.getElementById('safetyContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row critical-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <select class="safety-type" required>
                <option value="">סוג אירוע</option>
                <option value="near-miss">כמעט תאונה</option>
                <option value="violation">הפרת בטיחות</option>
                <option value="injury">פציעה קלה</option>
                <option value="serious">אירוע חמור</option>
                <option value="safe">אין אירועים - הכל תקין</option>
            </select>
            <select class="safety-severity">
                <option value="low">חומרה נמוכה</option>
                <option value="medium">חומרה בינונית</option>
                <option value="high">חומרה גבוהה</option>
            </select>
        </div>
        <textarea placeholder="תיאור האירוע" class="safety-description" required rows="2"></textarea>
        <textarea placeholder="פעולה מתקנת שבוצעה" class="safety-corrective" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addInspectionRow() {
    const container = document.getElementById('inspectionsContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row critical-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <input type="text" placeholder="שם המפקח" class="inspector-name" required>
            <select class="inspector-role" required>
                <option value="">תפקיד</option>
                <option value="building">מפקח בניה</option>
                <option value="safety">מפקח בטיחות</option>
                <option value="quality">בקרת איכות</option>
                <option value="client">נציג לקוח</option>
                <option value="engineer">מהנדס</option>
            </select>
            <input type="datetime-local" class="inspection-time" title="מועד ביקורת">
        </div>
        <textarea placeholder="ממצאים" class="inspection-findings" rows="2"></textarea>
        <textarea placeholder="תיקונים נדרשים" class="inspection-corrections" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addDelayRow() {
    const container = document.getElementById('delaysContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <select class="delay-reason" required>
                <option value="">סיבת עיכוב</option>
                <option value="weather">מזג אוויר</option>
                <option value="materials">חוסר חומרים</option>
                <option value="equipment">תקלת ציוד</option>
                <option value="client">לקוח</option>
                <option value="permits">היתרים/אישורים</option>
                <option value="workers">כוח אדם</option>
                <option value="other">אחר</option>
            </select>
            <select class="delay-responsible" required>
                <option value="">גורם אחראי</option>
                <option value="client">לקוח</option>
                <option value="contractor">קבלן</option>
                <option value="supplier">ספק</option>
                <option value="authority">רשות</option>
                <option value="force-majeure">כוח עליון</option>
            </select>
            <input type="number" placeholder="השפעה (שעות)" step="0.5" class="delay-hours">
        </div>
        <textarea placeholder="תיאור מפורט" class="delay-description" required rows="2"></textarea>
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
    // Basic data
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
    
    // LEGAL SECTION 1: Materials
    const materials = [];
    document.querySelectorAll('#materialsContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.material-type').value;
        const quantity = row.querySelector('.material-quantity').value;
        const unit = row.querySelector('.material-unit').value;
        const supplier = row.querySelector('.material-supplier').value;
        const deliveryTime = row.querySelector('.material-delivery-time').value;
        if (type && quantity) {
            materials.push({ 
                material_type: type,
                quantity,
                unit,
                supplier,
                delivery_time: deliveryTime || null
            });
        }
    });
    
    // LEGAL SECTION 2: Equipment
    const equipment = [];
    document.querySelectorAll('#equipmentContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.equipment-type').value;
        const hours = row.querySelector('.equipment-hours').value;
        const rental = row.querySelector('.equipment-rental').value === 'true';
        const issues = row.querySelector('.equipment-issues').value;
        if (type) {
            equipment.push({
                equipment_type: type,
                hours_used: parseFloat(hours) || 0,
                rental,
                issues
            });
        }
    });
    
    // LEGAL SECTION 3: Safety Incidents
    const safety = [];
    document.querySelectorAll('#safetyContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.safety-type').value;
        const severity = row.querySelector('.safety-severity').value;
        const description = row.querySelector('.safety-description').value;
        const corrective = row.querySelector('.safety-corrective').value;
        if (type && description) {
            safety.push({
                incident_type: type,
                severity,
                description,
                corrective_action: corrective
            });
        }
    });
    
    // LEGAL SECTION 4: Inspections
    const inspections = [];
    document.querySelectorAll('#inspectionsContainer .dynamic-row').forEach(row => {
        const name = row.querySelector('.inspector-name').value;
        const role = row.querySelector('.inspector-role').value;
        const time = row.querySelector('.inspection-time').value;
        const findings = row.querySelector('.inspection-findings').value;
        const corrections = row.querySelector('.inspection-corrections').value;
        if (name && role) {
            inspections.push({
                inspector_name: name,
                inspector_role: role,
                inspection_time: time || null,
                findings,
                required_corrections: corrections
            });
        }
    });
    
    // LEGAL SECTION 5: Delays
    const delays = [];
    document.querySelectorAll('#delaysContainer .dynamic-row').forEach(row => {
        const reason = row.querySelector('.delay-reason').value;
        const responsible = row.querySelector('.delay-responsible').value;
        const hours = row.querySelector('.delay-hours').value;
        const description = row.querySelector('.delay-description').value;
        if (reason && responsible && description) {
            delays.push({
                delay_reason: reason,
                responsible_party: responsible,
                impact_hours: parseFloat(hours) || 0,
                description
            });
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
        activities,
        materials,
        equipment,
        safety,
        inspections,
        delays
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
                project_name: data.project_name,
                report_date: data.report_date,
                manager_name: data.manager_name,
                weather: data.weather,
                start_time: data.start_time,
                end_time: data.end_time,
                break_hours: data.break_hours,
                total_work_hours: data.total_work_hours,
                general_notes: data.general_notes,
                tomorrow_date: data.tomorrow_date,
                tomorrow_plan: data.tomorrow_plan,
                manager_signature_path: signaturePath,
                status: 'draft'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Save related data
        await saveRelatedData(report.id, data);
        
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
                project_name: data.project_name,
                report_date: data.report_date,
                manager_name: data.manager_name,
                weather: data.weather,
                start_time: data.start_time,
                end_time: data.end_time,
                break_hours: data.break_hours,
                total_work_hours: data.total_work_hours,
                general_notes: data.general_notes,
                tomorrow_date: data.tomorrow_date,
                tomorrow_plan: data.tomorrow_plan,
                manager_signature_path: signaturePath,
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        await saveRelatedData(report.id, data);
        await uploadPhotos(report.id, selectedPhotos, 'manager');
        
        const shareURL = `${window.location.origin}${window.location.pathname}?token=${report.share_token}`;
        
        const message = `🔒 *דוח עבודה יומי מאובטח*\n\n` +
            `👷 *מנהל:* אבשי ספיר\n` +
            `🏗️ *פרוייקט:* ${data.project_name}\n` +
            `📅 *תאריך:* ${data.report_date}\n` +
            `⚖️ *תיעוד משפטי מלא*\n\n` +
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

async function saveRelatedData(reportId, data) {
    // Workers
    if (data.workers.length > 0) {
        await supabaseClient.from('workers').insert(
            data.workers.map(w => ({ ...w, report_id: reportId }))
        );
    }
    
    // Activities
    if (data.activities.length > 0) {
        await supabaseClient.from('activities').insert(
            data.activities.map(a => ({ ...a, report_id: reportId }))
        );
    }
    
    // Materials
    if (data.materials.length > 0) {
        await supabaseClient.from('materials').insert(
            data.materials.map(m => ({ ...m, report_id: reportId }))
        );
    }
    
    // Equipment
    if (data.equipment.length > 0) {
        await supabaseClient.from('equipment').insert(
            data.equipment.map(e => ({ ...e, report_id: reportId }))
        );
    }
    
    // Safety Incidents
    if (data.safety.length > 0) {
        await supabaseClient.from('safety_incidents').insert(
            data.safety.map(s => ({ ...s, report_id: reportId }))
        );
    }
    
    // Inspections
    if (data.inspections.length > 0) {
        await supabaseClient.from('inspections').insert(
            data.inspections.map(i => ({ ...i, report_id: reportId }))
        );
    }
    
    // Delays
    if (data.delays.length > 0) {
        await supabaseClient.from('delays').insert(
            data.delays.map(d => ({ ...d, report_id: reportId }))
        );
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
        
        document.getElementById('ownerPhotoInput').addEventListener('change', handleOwnerPhotoSelection);
        
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
    
    if (report.start_time && report.end_time) {
        html += `<p><strong>שעות עבודה:</strong> ${report.start_time} - ${report.end_time}`;
        if (report.total_work_hours) {
            html += ` (סה"כ: ${report.total_work_hours} שעות)`;
        }
        html += '</p>';
    }
    
    if (report.general_notes) html += `<p><strong>הערות:</strong> ${report.general_notes}</p>`;
    
    if (report.tomorrow_plan) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📅 תוכנית עבודה למחר</h3>';
        if (report.tomorrow_date) html += `<p><strong>תאריך:</strong> ${report.tomorrow_date}</p>`;
        html += `<p>${report.tomorrow_plan}</p>`;
    }
    
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
    
    // Display legal sections if they exist
    if (data.materials && data.materials.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📦 אספקות חומרים</h3>';
        data.materials.forEach(m => {
            html += `<p>• ${m.material_type}: ${m.quantity}`;
            if (m.unit) html += ` ${m.unit}`;
            if (m.supplier) html += ` (${m.supplier})`;
            html += '</p>';
        });
    }
    
    if (data.equipment && data.equipment.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>🚜 ציוד ומכונות</h3>';
        data.equipment.forEach(e => {
            html += `<p>• ${e.equipment_type}`;
            if (e.hours_used) html += ` (${e.hours_used} שעות)`;
            if (e.rental) html += ` [השכרה]`;
            html += '</p>';
        });
    }
    
    if (data.safety && data.safety.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>⚠️ בטיחות</h3>';
        data.safety.forEach(s => {
            html += `<p>• ${s.description}`;
            if (s.corrective_action) html += ` - ${s.corrective_action}`;
            html += '</p>';
        });
    }
    
    if (data.inspections && data.inspections.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>👮 ביקורות</h3>';
        data.inspections.forEach(i => {
            html += `<p>• ${i.inspector_name} (${i.inspector_role})`;
            if (i.findings) html += ` - ${i.findings}`;
            html += '</p>';
        });
    }
    
    if (data.delays && data.delays.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>⏰ עיכובים</h3>';
        data.delays.forEach(d => {
            html += `<p>• ${d.description}`;
            if (d.impact_hours) html += ` (${d.impact_hours} שעות)`;
            html += '</p>';
        });
    }
    
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
