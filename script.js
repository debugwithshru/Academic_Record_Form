document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('academicForm');
    const studentSearchInput = document.getElementById('student_id_search');
    const studentList = document.getElementById('studentList');
    const studentIdHidden = document.getElementById('student_id');
    const studentNameInput = document.getElementById('student_name');
    
    const WEBHOOK_URL = 'https://n8n.srv1498466.hstgr.cloud/webhook/cb6489f6-b8f7-4b9a-8486-1583b40ebd0f';
    const SHEET_ID = '16JAViFIXgf0oDqC5Nl0V6UpGqKrUVGAHkoEeYw1LdGs';
    const GID = '91172728';

    let allStudents = [];

    // 1. Fetch Student Data from Google Sheets using JSON endpoint (bypasses CORS)
    // 1. Fetch Student Data from Google Sheets using JSONP (Guaranteed to bypass CORS/Bot issues)
    async function fetchStudents() {
        try {
            const data = await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const cbName = 'gvizCallback_' + Math.floor(Math.random() * 100000);
                
                window[cbName] = function(jsonData) {
                    delete window[cbName];
                    script.remove();
                    resolve(jsonData);
                };
                
                script.onerror = () => {
                    delete window[cbName];
                    script.remove();
                    reject(new Error("Failed to load Google Sheets via JSONP"));
                };
                
                script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${cbName}&gid=${GID}`;
                document.body.appendChild(script);
            });

            const cols = data.table.cols;
            let idIdx = 0, firstIdx = 1, lastIdx = 2; // Default fallbacks if labels are empty

            if (cols) {
                const idCol = cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes('student_id') || c.label.toLowerCase().includes('roll')));
                if (idCol !== -1) idIdx = idCol;
                
                const fCol = cols.findIndex(c => c && c.label && c.label.toLowerCase().includes('first'));
                if (fCol !== -1) firstIdx = fCol;
                
                const lCol = cols.findIndex(c => c && c.label && c.label.toLowerCase().includes('last'));
                if (lCol !== -1) lastIdx = lCol;
            }

            allStudents = data.table.rows.map(row => {
                const c = row.c;
                if (!c || !c[idIdx] || !c[idIdx].v) return null; 
                
                const sid = String(c[idIdx].v).trim();
                
                // Skip if this row is actually the header row
                if (sid.toLowerCase().includes('student_id') || sid.toLowerCase().includes('roll no')) return null;

                const fname = (c[firstIdx] && c[firstIdx].v) ? String(c[firstIdx].v).trim() : '';
                const lname = (c[lastIdx] && c[lastIdx].v) ? String(c[lastIdx].v).trim() : '';
                const fullName = `${fname} ${lname}`.trim();
                
                return {
                    id: sid,
                    name: fullName || 'No Name'
                };
            }).filter(s => s !== null);

            studentList.innerHTML = '';
            if (allStudents.length === 0) {
                studentList.innerHTML = '<div class="dropdown-item no-results" style="padding:15px; color:#d63031; text-align:center;">No students found.<br>Double check sheet structure.</div>';
            } else {
                renderDropdown(allStudents); // Render all on load
            }
            console.log('Students loaded purely via JSONP:', allStudents.length);
        } catch (error) {
            console.error('Error fetching students:', error);
            studentList.innerHTML = `<div class="dropdown-item no-results" style="padding:15px; color:#d63031; text-align:center;">Google Sheets access blocked.<br>Try refreshing or verify Public link.</div>`;
        }
    }

    // Show dropdown on focus
    studentSearchInput.addEventListener('focus', () => {
        studentList.classList.add('active');
        const query = studentSearchInput.value.toLowerCase().trim();
        if (!query && allStudents.length > 0) {
            renderDropdown(allStudents); // Show ALL by default when focused
        }
    });

    // 2. Search & Filter Logic
    studentSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        studentList.classList.add('active');

        if (!query) {
            renderDropdown(allStudents);
            return;
        }

        const filtered = allStudents.filter(s => 
            s.id.toLowerCase().includes(query)
        );

        renderDropdown(filtered);
    });

    function renderDropdown(list) {
        studentList.innerHTML = '';
        if (list.length === 0) {
            studentList.innerHTML = '<div class="dropdown-item no-results" style="padding:15px; color:#d63031; display:flex; justify-content:center;">No matches found.</div>';
            return;
        }

        // Render ALL items in the list to allow scrolling
        list.forEach((student, index) => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.style.padding = '10px 16px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '15px';
            div.style.cursor = 'pointer';
            
            div.innerHTML = `
                <input type="radio" name="student_list_select" id="radio_${index}" value="${student.id}" style="cursor: pointer; transform: scale(1.1);">
                <label for="radio_${index}" style="cursor: pointer; font-size: 1rem; color: #495057; font-weight: 400; width: 100%;">${student.id} - ${student.name}</label>
            `;
            
            div.onclick = (e) => {
                e.preventDefault(); // Prevent double triggering with label
                selectStudent(student);
            };
            studentList.appendChild(div);
        });
    }

    function selectStudent(student) {
        studentSearchInput.value = student.id;
        studentIdHidden.value = student.id;
        studentNameInput.value = student.name;
        studentList.classList.remove('active');
        
        studentSearchInput.style.borderColor = '#f39200'; // Match brand focus color
        setTimeout(() => studentSearchInput.style.borderColor = '', 1000);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('studentDropdown').contains(e.target)) {
            studentList.classList.remove('active');
        }
    });

    // 3. Form Submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!studentIdHidden.value) {
            alert('Please select a valid Student ID from the dropdown.');
            studentSearchInput.focus();
            return;
        }

        const params = new URLSearchParams();
        params.append('student_id', studentIdHidden.value);
        params.append('student_name', studentNameInput.value);
        
        // Setup helper
        const getVal = (name) => {
            const el = form.querySelector(`[name="${name}"]`);
            return el ? el.value : '';
        };

        params.append('prior_school', getVal('prior_school'));
        params.append('prior_exam', getVal('prior_exam'));
        
        params.append('maths_ob', getVal('maths_ob'));
        params.append('maths_max', getVal('maths_max'));
        
        params.append('science_ob', getVal('science_ob'));
        params.append('science_max', getVal('science_max'));
        
        params.append('english_ob', getVal('english_ob'));
        params.append('english_max', getVal('english_max'));
        
        params.append('socsci_ob', getVal('socsci_ob'));
        params.append('socsci_max', getVal('socsci_max'));
        
        params.append('lang2_ob', getVal('lang2_ob'));
        params.append('lang2_max', getVal('lang2_max'));
        params.append('submission_date', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

        const finalUrl = `${WEBHOOK_URL}?${params.toString()}`;
        console.log('Submitting to n8n:', finalUrl);
        
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch(finalUrl, { method: 'GET', mode: 'no-cors' })
        .then(() => showSuccess())
        .catch(err => {
            console.error('Submission error:', err);
            alert('Error connecting to n8n.');
            btn.disabled = false;
            btn.textContent = 'Submit Academic Record';
        });
    });

    function showSuccess() {
        const overlay = document.getElementById('successOverlay');
        const btn = document.getElementById('submitBtn');
        overlay.classList.add('active');
        btn.textContent = 'Submitted!';
        btn.style.background = '#00b894';

        setTimeout(() => {
            overlay.classList.remove('active');
            btn.textContent = 'Submit Academic Record';
            btn.style.background = '';
            btn.disabled = false;
            form.reset();
            studentIdHidden.value = '';
            studentSearchInput.value = '';
        }, 3000);
    }

    // Initial load
    fetchStudents();
});
