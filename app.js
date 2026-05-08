/* ══════════════════════════════════════════
   PaddyGuard – Main JavaScript
   FREE API: Groq Cloud (Llama 3.2 Vision)
   Endpoint : api.groq.com
   Free tier: High RPM · Fast Inference
   Get key  : https://console.groq.com/keys
   ══════════════════════════════════════════ */

/* ══════════════════════════════
   PAGE NAVIGATION
══════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + name).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ══════════════════════════════
   FILE / IMAGE HANDLING
══════════════════════════════ */
let imageBase64   = null;
let imageMimeType = 'image/jpeg';

const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

function handleFile(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('Please upload an image file (JPG, PNG, etc.).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError('File size must be under 5MB.');
    return;
  }
  hideError();
  imageMimeType = file.type || 'image/jpeg';

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    imageBase64  = result.split(',')[1];

    document.getElementById('preview-img').src          = result;
    document.getElementById('preview-wrap').style.display = 'block';
    dropzone.style.display                               = 'none';
    document.getElementById('diagnose-btn').disabled    = false;
    document.getElementById('result-section').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  imageBase64 = null;
  document.getElementById('preview-img').src               = '';
  document.getElementById('preview-wrap').style.display    = 'none';
  dropzone.style.display                                   = 'block';
  document.getElementById('diagnose-btn').disabled         = true;
  document.getElementById('file-input').value              = '';
  document.getElementById('result-section').style.display  = 'none';
}

/* ══════════════════════════════
   ERROR HELPERS
══════════════════════════════ */
function showError(msg) {
  const box = document.getElementById('error-box');
  box.innerHTML = '⚠️ ' + msg;
  box.style.display = 'block';
}
function hideError() {
  document.getElementById('error-box').style.display = 'none';
}

/* ══════════════════════════════
   AI DIAGNOSIS
   API   : Google Gemini (FREE)
   Model : gemini-2.0-flash
   Docs  : https://ai.google.dev/api/generate-content
══════════════════════════════ */
async function diagnose() {
  const apiKey = document.getElementById('api-key-field').value.trim();

  if (!apiKey) {
    showError('Please enter your Groq API key. <a href="https://console.groq.com/keys" target="_blank" style="color:#2d6a36;font-weight:600;">Get a free key here →</a>');
    return;
  }
  if (!imageBase64) {
    showError('Please upload a paddy leaf image first.');
    return;
  }

  hideError();
  const btn = document.getElementById('diagnose-btn');
  btn.disabled  = true;
  btn.innerHTML = '⚡ Scanning...';

  // Trigger Scanning Effect
  document.body.classList.add('scanning');
  document.getElementById('result-section').style.display = 'none';

  const prompt = `You are PaddyGuard, an expert AI system for paddy (rice) leaf disease detection.

Analyze the provided paddy leaf image carefully and return a diagnosis.

Respond ONLY with a valid JSON object — no markdown, no backticks, no extra text — with these exact fields:
{
  "disease_name": "Name of the disease or 'Healthy Leaf'",
  "confidence": "High | Medium | Low",
  "type": "healthy | fungal | bacterial | pest | other",
  "summary": "2-3 sentence overview of the diagnosis",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "cause": "Brief cause — pathogen or pest name",
  "remedies": ["remedy 1", "remedy 2", "remedy 3"],
  "prevention": "1-2 sentences on prevention tips",
  "severity": "None | Mild | Moderate | Severe"
}

If the image is NOT a paddy/rice leaf, set disease_name to "Not a Paddy Leaf" and explain in summary.`;

  // ── Groq API (OpenAI Compatible) ──
  const GROQ_MODEL    = 'meta-llama/llama-4-scout-17b-16e-instruct';
  const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`
            }
          }
        ]
      }
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: "json_object" }
  };

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Handle API-level errors
    if (!response.ok) {
      const errMsg = data?.error?.message || 'Groq API request failed. Check your API key.';
      showError(errMsg);
      return;
    }

    // Extract text from Groq response structure
    const rawText = data?.choices?.[0]?.message?.content || '';

    if (!rawText) {
      showError('Empty response from Groq. Please try again.');
      return;
    }

    // Parse JSON result
    let result;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      showError('Could not parse AI response. Please try again with a clearer image.');
      return;
    }

    renderResult(result);

  } catch (err) {
    showError('Network error: ' + err.message + '. Make sure you are connected to the internet.');
  } finally {
    document.body.classList.remove('scanning');
    btn.disabled  = false;
    btn.innerHTML = '🔬 Diagnose Leaf';
  }
}

/* ══════════════════════════════
   RENDER RESULT
══════════════════════════════ */
function renderResult(r) {
  const section = document.getElementById('result-section');
  const card    = document.getElementById('result-card');

  const isHealthy  = r.type === 'healthy';
  const iconClass  = isHealthy ? 'healthy' : (r.confidence === 'Low' ? 'warning' : 'disease');
  const emoji      = isHealthy          ? '✅'
                   : r.type === 'pest'      ? '🐛'
                   : r.type === 'bacterial' ? '🦠'
                   : '🍄';

  const confClass  = r.confidence === 'High'   ? 'high'
                   : r.confidence === 'Medium' ? 'medium'
                   : 'low';

  const severityColor = { 'None':'#4caf50','Mild':'#f0c842','Moderate':'#e67e22','Severe':'#e74c3c' }[r.severity] || '#888';

  const symptomsHtml = Array.isArray(r.symptoms) && r.symptoms.length
    ? '<ul>' + r.symptoms.map(s => `<li>${s}</li>`).join('') + '</ul>'
    : '<p>No specific symptoms listed.</p>';

  const remediesHtml = Array.isArray(r.remedies) && r.remedies.length
    ? '<ul>' + r.remedies.map(s => `<li>${s}</li>`).join('') + '</ul>'
    : '<p>No specific remedies listed.</p>';

  card.innerHTML = `
    <div class="result-header">
      <div class="disease-icon ${iconClass}">${emoji}</div>
      <div>
        <div class="disease-name">${r.disease_name || 'Unknown'}</div>
        <span class="confidence-badge ${confClass}">● ${r.confidence || '—'} Confidence</span>
        &nbsp;
        <span class="confidence-badge" style="background:rgba(0,0,0,0.05);color:${severityColor}">
          Severity: ${r.severity || '—'}
        </span>
      </div>
    </div>

    <div class="result-full" style="margin-bottom:20px">
      <h4>🔬 Diagnosis Summary</h4>
      <p>${r.summary || 'No summary available.'}</p>
      ${r.cause ? `<p style="margin-top:10px"><strong>Cause:</strong> ${r.cause}</p>` : ''}
    </div>

    <div class="result-grid">
      <div class="result-box">
        <h4>🌿 Symptoms Observed</h4>
        ${symptomsHtml}
      </div>
      <div class="result-box remedy">
        <h4>💊 Recommended Remedies</h4>
        ${remediesHtml}
      </div>
    </div>

    ${r.prevention ? `
    <div class="result-full" style="margin-top:20px">
      <h4>🛡️ Prevention Tips</h4>
      <p>${r.prevention}</p>
    </div>` : ''}

    <p style="font-size:0.72rem;color:var(--text-light);margin-top:18px;text-align:right;">
      Powered by Groq Cloud (Llama 4 Scout Vision)
    </p>
  `;

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
