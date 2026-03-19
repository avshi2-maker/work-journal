// ══════════════════════════════════════════════════════
// PHOTO GALLERY — per project
// ══════════════════════════════════════════════════════

var _spReportCache = {};
var _galleryProjectId   = null;
var _galleryProjectName = '';
var _galleryPhotos      = [];

async function openPhotoGallery(projectId, projectName) {
  _galleryProjectId   = projectId;
  _galleryProjectName = projectName;
  _galleryPhotos      = [];

  document.getElementById('gallery-modal-title').textContent = '📸 ' + projectName;
  document.getElementById('gallery-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3);">Loading photos...</div>';
  document.getElementById('modal-gallery').style.display = 'flex';

  await galleryLoad();
}

async function galleryLoad() {
  try {
    // Fetch photos from site_reports for this project
    var res = await fetch(
      SUPABASE_URL_CONST + '/rest/v1/site_reports?project_id=eq.' + _galleryProjectId +
      '&status=eq.approved&select=id,report_date,submitted_by,photos,contractor_name',
      { headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST } }
    );
    var reports = await res.json();

    _galleryPhotos = [];

    // Pull photos from approved site_reports
    (reports || []).forEach(function(r) {
      var photos = [];
      try { photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []); } catch(e){}
      photos.forEach(function(path) {
        _galleryPhotos.push({
          path:     path,
          url:      SUPABASE_URL_CONST + '/storage/v1/object/public/photos/' + path,
          date:     r.report_date,
          source:   'site_pulse',
          caption:  (r.contractor_name || '') + (r.report_date ? ' · ' + new Date(r.report_date+'T12:00:00').toLocaleDateString('he-IL') : '') + (r.submitted_by ? ' · by ' + r.submitted_by : '')
        });
      });
    });

    // Also fetch manually uploaded photos from Supabase Storage
    // List files in photos/projects/<projectId>/
    try {
      var storRes = await sb.storage.from('photos').list('projects/' + _galleryProjectId, { limit: 100 });
      if (storRes.data && storRes.data.length) {
        storRes.data.forEach(function(f) {
          var path = 'projects/' + _galleryProjectId + '/' + f.name;
          _galleryPhotos.push({
            path:    path,
            url:     SUPABASE_URL_CONST + '/storage/v1/object/public/photos/' + path,
            date:    f.created_at ? f.created_at.split('T')[0] : null,
            source:  'manual',
            caption: f.name.replace(/_/g,' ')
          });
        });
      }
    } catch(e) {}

    renderGallery();

  } catch(e) {
    document.getElementById('gallery-grid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--red);">Error: ' + e.message + '</div>';
  }
}

function renderGallery() {
  var grid    = document.getElementById('gallery-grid');
  var filter  = document.getElementById('gallery-filter-source')?.value || 'all';
  var countEl = document.getElementById('gallery-count');

  var filtered = filter === 'all' ? _galleryPhotos :
    _galleryPhotos.filter(function(p){ return p.source === filter; });

  if (countEl) countEl.textContent = filtered.length + ' photo' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">' +
      '<div style="font-size:40px;margin-bottom:10px;">📷</div>' +
      '<div>No photos yet for this project</div>' +
      '<div style="font-size:12px;margin-top:6px;">Upload photos above or approve Site Pulse reports with photos</div>' +
      '</div>';
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(function(ph, i) {
    var div = document.createElement('div');
    div.style.cssText = 'position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:pointer;';

    var img = document.createElement('img');
    img.src = ph.url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:transform 0.2s;';
    img.onerror = function() { this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="40">📷</text></svg>'; };
    img.addEventListener('mouseenter', function(){ this.style.transform = 'scale(1.05)'; });
    img.addEventListener('mouseleave', function(){ this.style.transform = 'scale(1)'; });

    // Source badge
    var badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;font-size:9px;padding:2px 5px;border-radius:4px;';
    badge.textContent = ph.source === 'site_pulse' ? '🏗️' : '📤';

    // Caption on hover
    if (ph.date) {
      var cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;font-size:10px;padding:12px 4px 4px;text-align:center;';
      cap.textContent = new Date(ph.date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
      div.appendChild(cap);
    }

    div.addEventListener('click', function(){ openLightbox(ph.url, ph.caption); });
    div.appendChild(img);
    div.appendChild(badge);
    grid.appendChild(div);
  });
}

// ── Upload photos manually to project gallery ─────────────
async function galleryUpload(input) {
  var files = Array.from(input.files || []);
  if (!files.length || !_galleryProjectId) return;
  var statusEl = document.getElementById('gallery-upload-status');
  if (statusEl) statusEl.textContent = 'Uploading...';

  var uploaded = 0;
  for (var i = 0; i < files.length; i++) {
    try {
      var f    = files[i];
      var ext  = f.name.split('.').pop() || 'jpg';
      var path = 'projects/' + _galleryProjectId + '/' + Date.now() + '_' + i + '.' + ext;
      var { error } = await sb.storage.from('photos').upload(path, f, { upsert: false });
      if (!error) uploaded++;
    } catch(e) { console.error('upload:', e); }
  }

  input.value = '';
  if (statusEl) statusEl.textContent = uploaded + ' uploaded ✅';
  setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
  await galleryLoad(); // Refresh
}

// ── Lightbox ──────────────────────────────────────────────
function openLightbox(url, caption) {
  document.getElementById('lightbox-img').src       = url;
  document.getElementById('lightbox-caption').textContent = caption || '';
  var lb = document.getElementById('photo-lightbox');
  if (lb) { lb.style.display = 'flex'; }
}

function closeLightbox() {
  var lb = document.getElementById('photo-lightbox');
  if (lb) lb.style.display = 'none';
}

// Close lightbox on click outside image
document.addEventListener('click', function(e) {
  var lb = document.getElementById('photo-lightbox');
  if (lb && lb.style.display === 'flex' && e.target === lb) closeLightbox();
});

