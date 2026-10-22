const DEADLINE_ISO = '2026-10-30T17:00:00+08:00';
        const DEADLINE_TIMESTAMP = new Date(DEADLINE_ISO).getTime();

        const DEFAULT_POLICY_RULES = {
            'Merit Scholar': { maxGwa: 1.75, minUnits: 18, maxFailed: 0, maxInc: 0, maxDropped: 0 },
            'Community Scholar': { maxGwa: 2.25, minUnits: 15, maxFailed: 0, maxInc: 0, maxDropped: 1 }
        };
        let policyRules = structuredClone(DEFAULT_POLICY_RULES);

        const INITIAL_STUDENTS = [
            {
                id: '2024-00129',
                name: 'Jane Doe',
                program: 'Merit Scholar',
                submissions: [
                    {
                        id: 'sub-101',
                        submittedAt: '2026-10-25T14:30:00+08:00',
                        gwa: 1.50,
                        units: 18,
                        failed: 0,
                        inc: 0,
                        dropped: 0,
                        docRef: 'https://drive.google.com/file/d/janedoe_grades',
                        notes: 'Submitted grade slip certified by registrar.',
                        verificationStatus: 'Verified',
                        complianceStatus: 'Compliant',
                        renewalDecision: 'Approved',
                        staffRemarks: 'All criteria satisfied.'
                    }
                ]
            },
            {
                id: '2024-00215',
                name: 'Mark Santos',
                program: 'Merit Scholar',
                submissions: [
                    {
                        id: 'sub-102',
                        submittedAt: '2026-10-28T09:15:00+08:00',
                        gwa: 1.85, 
                        units: 18,
                        failed: 0,
                        inc: 0,
                        dropped: 0,
                        docRef: 'https://drive.google.com/file/d/marksantos_grades',
                        notes: 'Had difficulty in Advanced Calculus.',
                        verificationStatus: 'Verified',
                        complianceStatus: 'With Deficiency',
                        renewalDecision: 'Held',
                        staffRemarks: 'GWA exceeds 1.75 limit for Merit program.'
                    }
                ]
            },
            {
                id: '2024-00388',
                name: 'Maria Cruz',
                program: 'Community Scholar',
                submissions: [
                    {
                        id: 'sub-103',
                        submittedAt: '2026-10-30T16:50:00+08:00', 
                        gwa: 2.10,
                        units: 15,
                        failed: 0,
                        inc: 0,
                        dropped: 1, 
                        docRef: 'https://drive.google.com/file/d/mariacruz_grades',
                        notes: '1 subject dropped with permit.',
                        verificationStatus: 'Pending',
                        complianceStatus: 'Pending Evaluation',
                        renewalDecision: 'Pending Decision',
                        staffRemarks: ''
                    }
                ]
            },
            {
                id: '2024-00401',
                name: 'Alex Reyes',
                program: 'Community Scholar',
                submissions: [
                    {
                        id: 'sub-104',
                        submittedAt: '2026-10-31T08:20:00+08:00',
                        gwa: 2.50, 
                        units: 14, 
                        failed: 1,
                        inc: 0,
                        dropped: 2,
                        docRef: 'https://drive.google.com/file/d/alexreyes_grades',
                        notes: 'Submitted late due to medical reasons.',
                        verificationStatus: 'Pending',
                        complianceStatus: 'Pending Evaluation',
                        renewalDecision: 'Pending Decision',
                        staffRemarks: ''
                    }
                ]
            }
        ];


        let appData = [];
        let currentRole = 'student';
        let currentActiveStudentId = '2024-00129'; 
        let activeReviewSubId = null;
        let adminChart = null;
        let supabaseClient = null;
        const DEFAULT_SCHOLARSHIP_PROGRAMS = [
            { id: 'local-merit', name: 'Merit Scholar' },
            { id: 'local-community', name: 'Community Scholar' }
        ];
        let scholarshipPrograms = [...DEFAULT_SCHOLARSHIP_PROGRAMS];

        const SUPABASE_DEFAULT_URL = "https://uilukbjngzdgyjtuwooc.supabase.co";
        const SUPABASE_DEFAULT_ANON_KEY = "sb_publishable_kSPne7ZQQX-uRAilTEK0Vw_oqdj-bfR";

        window.addEventListener('load', async function () {
            loadInitialData();
            initializeSupabase();
            if (supabaseClient) {
                try {
                    await loadScholarData();
                } catch (error) {
                    console.error('Failed to load scholarship data from Supabase:', error);
                    setSupabaseStatus('Supabase connection failed', 'text-rose-600');
                    showToast('Supabase connection failed. Showing locally saved data.', 'error');
                }
                try {
                    await loadPolicyRules();
                    subscribeToPolicyChanges();
                } catch (error) {
                    console.error('Failed to load scholarship policy rules from Supabase:', error);
                    showToast('Could not load shared policy rules. Using locally saved rules.', 'error');
                }
            }
            populateConfigForm();
            renderPolicyCriteria();
            switchRole('student');
        });

        function loadInitialData() {
            const savedData = localStorage.getItem('scholar_system_data');
            if (savedData) {
                try {
                    appData = JSON.parse(savedData);
                } catch (error) {
                    console.error('Failed to read locally saved scholarship data:', error);
                    appData = INITIAL_STUDENTS;
                    showToast('Saved local data could not be read. Showing sample data.', 'error');
                }
            } else {
                appData = structuredClone(INITIAL_STUDENTS);
            }
            appData.forEach(student => {
                student.registrationStatus ||= 'Confirmed';
            });

            const savedRules = localStorage.getItem('scholar_policy_rules');
            if (savedRules) {
                try {
                    policyRules = mergePolicyRules(JSON.parse(savedRules));
                } catch (error) {
                    console.error('Failed to read locally saved policy rules:', error);
                    showToast('Saved policy rules could not be read. Using default rules.', 'error');
                }
            }
        }

        function mergePolicyRules(rules) {
            return Object.fromEntries(Object.entries(DEFAULT_POLICY_RULES).map(([program, defaults]) => [
                program,
                { ...defaults, ...(rules?.[program] || {}) }
            ]));
        }

        async function loadPolicyRules() {
            if (!supabaseClient) return;
            const { data, error } = await supabaseClient
                .from('scholarship_policy_rules')
                .select('program_name, max_gwa, min_units, max_failed, max_inc, max_dropped');
            if (error) throw error;

            const loadedRules = structuredClone(policyRules);
            (data || []).forEach(row => {
                if (!loadedRules[row.program_name]) return;
                loadedRules[row.program_name] = {
                    maxGwa: Number(row.max_gwa),
                    minUnits: Number(row.min_units),
                    maxFailed: Number(row.max_failed),
                    maxInc: Number(row.max_inc),
                    maxDropped: Number(row.max_dropped)
                };
            });
            policyRules = mergePolicyRules(loadedRules);
            localStorage.setItem('scholar_policy_rules', JSON.stringify(policyRules));
        }

        function subscribeToPolicyChanges() {
            supabaseClient
                .channel('scholarship-policy-rules')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'scholarship_policy_rules'
                }, async () => {
                    try {
                        await loadPolicyRules();
                        populateConfigForm();
                        renderPolicyCriteria();
                    } catch (error) {
                        console.error('Failed to refresh scholarship policy rules:', error);
                        showToast('Could not refresh shared policy rules.', 'error');
                    }
                })
                .subscribe();
        }

        function initializeSupabase(url, key) {
            if (url && key) {
                supabaseClient = window.supabase.createClient(url, key);
                setSupabaseStatus('Connecting to Supabase...', 'text-amber-600');
                return;
            }

            if (localStorage.getItem('supabase_mode') === 'local') {
                supabaseClient = null;
                setSupabaseStatus('Local Storage Mode', 'text-emerald-600');
                return;
            }

            const savedUrl = localStorage.getItem('supabase_url') || SUPABASE_DEFAULT_URL;
            const savedKey = localStorage.getItem('supabase_key') || SUPABASE_DEFAULT_ANON_KEY;
            supabaseClient = window.supabase.createClient(savedUrl, savedKey);
            setSupabaseStatus('Connecting to Supabase...', 'text-amber-600');
        }

        function setSupabaseStatus(message, className) {
            const status = document.getElementById('sp-status-text');
            if (status) {
                status.innerText = message;
                status.className = `${className} font-semibold`;
            }
        }

        function getRelatedRecord(record) {
            return Array.isArray(record) ? record[0] : record;
        }

        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
        }

        function mapSubmission(row) {
            return {
                id: row.id,
                submittedAt: row.submitted_at,
                gwa: Number(row.gwa),
                units: Number(row.enrolled_units),
                failed: Number(row.failed_subjects || 0),
                inc: Number(row.inc_grades || 0),
                dropped: Number(row.dropped_subjects || 0),
                docRef: row.doc_reference || '',
                notes: '',
                verificationStatus: row.verification_status || 'Pending',
                complianceStatus: row.compliance_status || 'Pending Evaluation',
                renewalDecision: row.renewal_decision || 'Pending Decision',
                staffRemarks: row.remarks || ''
            };
        }

        async function loadScholarData() {
            const { data: programs, error: programsError } = await supabaseClient
                .from('scholarship_programs')
                .select('id, name')
                .order('name');

            if (programsError) {
                throw programsError;
            }
            scholarshipPrograms = programs?.length ? programs : [...DEFAULT_SCHOLARSHIP_PROGRAMS];

            const { data, error } = await supabaseClient
                .from('student_records')
                .select(`
      id,
      student_id_number,
      registration_status,
      reviewed_at,
      review_remarks,
      profiles ( full_name, email ),
      scholarship_programs ( name ),
      submissions (
        id,
        gwa,
        enrolled_units,
        failed_subjects,
        inc_grades,
        dropped_subjects,
        doc_reference,
        submitted_at,
        verification_status,
        compliance_status,
        renewal_decision,
        remarks
      )
    `);

            if (error) {
                throw error;
            }

            appData = (data || []).map(studentRecord => {
                const profile = getRelatedRecord(studentRecord.profiles);
                const program = getRelatedRecord(studentRecord.scholarship_programs);
                const submissions = Array.isArray(studentRecord.submissions)
                    ? studentRecord.submissions.map(mapSubmission)
                    : [];
                submissions.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
                return {
                    id: String(studentRecord.student_id_number || studentRecord.id),
                    studentRecordId: studentRecord.id,
                    name: profile?.full_name || 'Student',
                    email: profile?.email || '',
                    program: program?.name || 'Unassigned Program',
                    registrationStatus: studentRecord.registration_status || 'Confirmed',
                    reviewedAt: studentRecord.reviewed_at || null,
                    reviewRemarks: studentRecord.review_remarks || '',
                    submissions
                };
            });
            if (!appData.some(student => student.id === currentActiveStudentId)) {
                currentActiveStudentId = appData[0]?.id || '';
            }
            setSupabaseStatus('Connected to Supabase', 'text-brand-600');
        }

        function saveData() {
            localStorage.setItem('scholar_system_data', JSON.stringify(appData));
        }

        function switchRole(role) {
            currentRole = role;
            document.getElementById('role-select').value = role;

            document.querySelectorAll('.role-view').forEach(v => v.classList.add('hidden'));

            const tabsContainer = document.getElementById('role-tabs');
            tabsContainer.innerHTML = '';

            if (role === 'student') {
                document.getElementById('view-student').classList.remove('hidden');
                tabsContainer.innerHTML = `
                    <button class="py-3 text-brand-600 border-b-2 border-brand-600 font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <i class="fa-solid fa-user-graduate"></i> My Scholarship Status
                    </button>
                `;
                renderStudentDashboard();
            } else if (role === 'staff') {
                document.getElementById('view-staff').classList.remove('hidden');
                tabsContainer.innerHTML = `
                    <button class="py-3 text-brand-600 border-b-2 border-brand-600 font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <i class="fa-solid fa-clipboard-list"></i> Evaluation Queue
                    </button>
                `;
                renderStaffRegistrations();
                renderStaffQueue();
            } else if (role === 'admin') {
                document.getElementById('view-admin').classList.remove('hidden');
                tabsContainer.innerHTML = `
                    <button class="py-3 text-brand-600 border-b-2 border-brand-600 font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <i class="fa-solid fa-chart-line"></i> Summary Analytics & Config
                    </button>
                `;
                renderAdminDashboard();
            }
        }

        function renderStudentDashboard() {
            renderStudentSelector();
            const student = appData.find(s => s.id === currentActiveStudentId) || appData[0];
            const tbody = document.getElementById('student-history-tbody');
            tbody.innerHTML = '';

            if (!student) {
                document.getElementById('student-name').innerText = 'No student record available';
                document.getElementById('student-avatar').innerText = '--';
                document.getElementById('student-id-display').innerText = '--';
                document.getElementById('student-program-badge').innerText = 'No program';
                document.getElementById('student-verify-status').innerText = 'No data';
                document.getElementById('student-compliance-status').innerText = 'No data';
                document.getElementById('student-renewal-status').innerText = 'No data';
                tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">No student submissions found.</td></tr>`;
                return;
            }

            document.getElementById('student-name').innerText = student.name;
            document.getElementById('student-avatar').innerText = getInitials(student.name);
            document.getElementById('student-id-display').innerText = student.id;
            document.getElementById('student-program-badge').innerText = student.registrationStatus === 'Confirmed'
                ? student.program
                : `Registration ${student.registrationStatus}`;
            document.getElementById('form-program').value = student.program;
            const registrationNotice = document.getElementById('student-registration-notice');
            const canSubmit = student.registrationStatus === 'Confirmed';
            registrationNotice.classList.toggle('hidden', canSubmit);
            registrationNotice.innerText = student.registrationStatus === 'Rejected'
                ? 'This student registration was rejected. Contact the scholarship office for details.'
                : 'This student record is awaiting staff confirmation and scholarship assignment. Academic requirements can be submitted after confirmation.';
            document.querySelectorAll('#submission-form input, #submission-form textarea, #submission-form button[type="submit"]')
                .forEach(control => { control.disabled = !canSubmit; });

            const latestSub = student.submissions.length > 0 ? student.submissions[student.submissions.length - 1] : null;

            if (latestSub) {
                document.getElementById('student-verify-status').innerHTML = getStatusPill(latestSub.verificationStatus);
                document.getElementById('student-compliance-status').innerHTML = getStatusPill(latestSub.complianceStatus);
                document.getElementById('student-renewal-status').innerHTML = getStatusPill(latestSub.renewalDecision);
            } else if (!canSubmit) {
                document.getElementById('student-verify-status').innerHTML = getStatusPill(student.registrationStatus);
                document.getElementById('student-compliance-status').innerText = 'Not evaluated';
                document.getElementById('student-renewal-status').innerText = 'Not eligible yet';
            } else {
                document.getElementById('student-verify-status').innerHTML = getStatusPill('Pending');
                document.getElementById('student-compliance-status').innerText = 'Pending Eval';
                document.getElementById('student-renewal-status').innerText = 'Pending';
            }

            if (student.submissions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">No submissions recorded yet.</td></tr>`;
                return;
            }

            student.submissions.forEach(sub => {
                const subDate = new Date(sub.submittedAt);
                const isLate = subDate.getTime() > DEADLINE_TIMESTAMP;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition";
                tr.innerHTML = `
                    <td class="p-3 font-medium text-slate-700">${formatDateTime(sub.submittedAt)}</td>
                    <td class="p-3">GWA: <strong>${sub.gwa.toFixed(2)}</strong> | Units: ${sub.units}</td>
                    <td class="p-3">${isLate ? '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Late</span>' : '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold"><i class="fa-solid fa-check mr-1"></i>On Time</span>'}</td>
                    <td class="p-3">${getStatusPill(sub.verificationStatus)}</td>
                    <td class="p-3">${getStatusPill(sub.complianceStatus)}</td>
                    <td class="p-3">${getStatusPill(sub.renewalDecision)}</td>
                    <td class="p-3 text-right">
                        <a href="${escapeHtml(sub.docRef)}" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline"><i class="fa-solid fa-arrow-up-right-from-square"></i> Link</a>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderStudentSelector() {
            const selector = document.getElementById('student-selector');
            selector.replaceChildren();
            appData.filter(student => student.registrationStatus === 'Confirmed' || student.registrationStatus === 'Pending' || student.registrationStatus === 'Rejected')
                .forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.name} (${student.id})${student.registrationStatus === 'Confirmed' ? '' : ` — ${student.registrationStatus}`}`;
                option.selected = student.id === currentActiveStudentId;
                selector.appendChild(option);
            });
            selector.disabled = appData.length < 2;
        }

        function selectStudent(studentId) {
            if (!appData.some(student => student.id === studentId)) return;
            currentActiveStudentId = studentId;
            renderStudentDashboard();
        }

        async function handleStudentSubmission(e) {
            e.preventDefault();
            const student = appData.find(s => s.id === currentActiveStudentId);
            if (!student) {
                showToast('No student record is available for this submission.', 'error');
                return;
            }
            if (student.registrationStatus !== 'Confirmed' || !student.program || student.program === 'Unassigned Program') {
                showToast('Staff must confirm this student and assign a scholarship program before submission.', 'error');
                return;
            }

            const gwa = parseFloat(document.getElementById('form-gwa').value);
            const units = parseInt(document.getElementById('form-units').value);
            const failed = parseInt(document.getElementById('form-failed').value);
            const inc = parseInt(document.getElementById('form-inc').value);
            const dropped = parseInt(document.getElementById('form-dropped').value);
            const docRef = document.getElementById('form-doc-ref').value;
            const notes = document.getElementById('form-notes').value;
            const submittedAt = new Date().toISOString();

            const newSubmission = {
                id: 'sub-' + Date.now(),
                submittedAt,
                gwa: gwa,
                units: units,
                failed: failed,
                inc: inc,
                dropped: dropped,
                docRef: docRef,
                notes: notes,
                verificationStatus: 'Pending',
                complianceStatus: 'Pending Evaluation',
                renewalDecision: 'Pending Decision',
                staffRemarks: ''
            };

            if (supabaseClient) {
                if (!student.studentRecordId) {
                    showToast('This student is not linked to a Supabase student record.', 'error');
                    return;
                }

                let data;
                let error;
                try {
                    ({ data, error } = await supabaseClient
                        .from('submissions')
                        .insert({
                            student_id: student.studentRecordId,
                            academic_term: '1st Semester 2026-2027',
                            gwa,
                            enrolled_units: units,
                            failed_subjects: failed,
                            inc_grades: inc,
                            dropped_subjects: dropped,
                            doc_reference: docRef,
                            submitted_at: submittedAt
                        })
                        .select('id, gwa, enrolled_units, failed_subjects, inc_grades, dropped_subjects, doc_reference, submitted_at, verification_status, compliance_status, renewal_decision, remarks')
                        .single());
                } catch (requestError) {
                    console.error('Failed to submit requirements to Supabase:', requestError);
                    showToast('Submission failed because Supabase could not be reached.', 'error');
                    return;
                }

                if (error) {
                    console.error('Failed to submit requirements to Supabase:', error);
                    showToast('Submission failed. Check the Supabase connection and access policies.', 'error');
                    return;
                }

                newSubmission.id = data.id;
                Object.assign(newSubmission, mapSubmission(data), { notes });
            }

            student.submissions.push(newSubmission);
            saveData();
            showToast('Requirements submitted successfully!', 'success');
            renderStudentDashboard();
            e.target.reset();
        }

        function renderStaffQueue() {
            const tbody = document.getElementById('staff-queue-tbody');
            tbody.innerHTML = '';

            const searchKey = document.getElementById('staff-search').value.toLowerCase();
            const programFilter = document.getElementById('staff-filter-program').value;
            const verifyFilter = document.getElementById('staff-filter-verify').value;
            const complianceFilter = document.getElementById('staff-filter-compliance').value;

            let pendingVerifyCount = 0;
            let pendingEvalCount = 0;
            let compliantCount = 0;
            let deficiencyCount = 0;

            let allRows = [];

            appData.forEach(student => {
                student.submissions.forEach(sub => {
                    if (sub.verificationStatus === 'Pending') pendingVerifyCount++;
                    if (sub.complianceStatus === 'Pending Evaluation') pendingEvalCount++;
                    if (sub.complianceStatus === 'Compliant') compliantCount++;
                    if (sub.complianceStatus === 'With Deficiency') deficiencyCount++;

                    const matchesSearch = student.name.toLowerCase().includes(searchKey) || student.id.toLowerCase().includes(searchKey);
                    const matchesProgram = programFilter === 'ALL' || student.program === programFilter;
                    const matchesVerify = verifyFilter === 'ALL' || sub.verificationStatus === verifyFilter;
                    const matchesCompliance = complianceFilter === 'ALL' || sub.complianceStatus === complianceFilter;

                    if (matchesSearch && matchesProgram && matchesVerify && matchesCompliance) {
                        allRows.push({ student, sub });
                    }
                });
            });

            document.getElementById('cnt-pending-verify').innerText = pendingVerifyCount;
            document.getElementById('cnt-pending-eval').innerText = pendingEvalCount;
            document.getElementById('cnt-compliant').innerText = compliantCount;
            document.getElementById('cnt-deficiency').innerText = deficiencyCount;

            if (allRows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">No student submissions matching filters.</td></tr>`;
                return;
            }

            allRows.reverse().forEach(({ student, sub }) => {
                const subDate = new Date(sub.submittedAt);
                const isLate = subDate.getTime() > DEADLINE_TIMESTAMP;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
                tr.innerHTML = `
                    <td class="p-3 font-semibold text-slate-800">${escapeHtml(student.name)}<br><span class="text-[10px] text-slate-400 font-normal">ID: ${escapeHtml(student.id)}</span></td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">${escapeHtml(student.program)}</span></td>
                    <td class="p-3">GWA: <strong>${sub.gwa.toFixed(2)}</strong> | Units: ${sub.units}<br><span class="text-[10px] text-slate-400">F:${sub.failed} | INC:${sub.inc} | D:${sub.dropped}</span></td>
                    <td class="p-3">${isLate ? '<span class="text-rose-600 font-bold text-[10px]"><i class="fa-solid fa-clock"></i> Late</span>' : '<span class="text-emerald-600 font-bold text-[10px]"><i class="fa-solid fa-check"></i> On Time</span>'}</td>
                    <td class="p-3">${getStatusPill(sub.verificationStatus)}</td>
                    <td class="p-3">${getStatusPill(sub.complianceStatus)}</td>
                    <td class="p-3">${getStatusPill(sub.renewalDecision)}</td>
                    <td class="p-3 text-center">
                        <button class="review-submission bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md font-medium text-[11px] shadow-sm transition">
                            <i class="fa-solid fa-eye mr-1"></i> Review
                        </button>
                    </td>
                `;
                const reviewButton = tr.querySelector('.review-submission');
                reviewButton.addEventListener('click', () => openReviewModal(student.id, sub.id));
                tbody.appendChild(tr);
            });
        }

        function renderStaffRegistrations() {
            const tbody = document.getElementById('staff-registration-tbody');
            const pendingStudents = appData.filter(student => student.registrationStatus === 'Pending');
            tbody.replaceChildren();

            if (pendingStudents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No student registrations are waiting for confirmation.</td></tr>';
                return;
            }

            pendingStudents.forEach(student => {
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-100';
                row.innerHTML = `
                    <td class="p-3 font-semibold">${escapeHtml(student.id)}</td>
                    <td class="p-3">${escapeHtml(student.name)}</td>
                    <td class="p-3">${escapeHtml(student.email || '—')}</td>
                    <td class="p-3"><select class="registration-program w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"></select></td>
                    <td class="p-3">
                        <input class="registration-remarks w-full text-xs border border-slate-300 rounded-lg p-2"
                            maxlength="1000" placeholder="Review details or eligibility notes">
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                        <button class="confirm-registration bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg">Confirm</button>
                        <button class="reject-registration bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3 py-2 rounded-lg ml-1">Reject</button>
                    </td>
                `;
                const programSelect = row.querySelector('.registration-program');
                scholarshipPrograms.forEach(program => {
                    const option = document.createElement('option');
                    option.value = program.name;
                    option.textContent = program.name;
                    programSelect.appendChild(option);
                });
                row.querySelector('.confirm-registration').addEventListener('click', () => confirmStudentRegistration(student, row));
                row.querySelector('.reject-registration').addEventListener('click', () => rejectStudentRegistration(student, row));
                tbody.appendChild(row);
            });
        }

        async function confirmStudentRegistration(student, row) {
            const program = row.querySelector('.registration-program').value;
            const remarks = row.querySelector('.registration-remarks').value.trim();
            if (!program) {
                showToast('No scholarship programs are available. Add programs to the Supabase scholarship_programs table first.', 'error');
                return;
            }
            if (!student.studentRecordId) {
                showToast('This student is missing a database record ID.', 'error');
                return;
            }

            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient.rpc('confirm_student_registration', {
                        p_student_record_id: student.studentRecordId,
                        p_program_name: program,
                        p_review_remarks: remarks || null
                    });
                    if (error) throw error;
                } catch (error) {
                    console.error('Failed to confirm student registration:', error);
                    showToast(error.message || 'Could not confirm this student in Supabase.', 'error');
                    return;
                }
            }

            student.registrationStatus = 'Confirmed';
            student.program = program;
            student.reviewRemarks = remarks;
            student.reviewedAt = new Date().toISOString();
            saveData();
            renderStaffRegistrations();
            renderStaffQueue();
            renderAdminRoster();
            renderStudentSelector();
            showToast('Student confirmed and scholarship program assigned.', 'success');
        }

        async function rejectStudentRegistration(student, row) {
            const remarks = row.querySelector('.registration-remarks').value.trim();
            if (!student.studentRecordId) {
                showToast('This student is missing a database record ID.', 'error');
                return;
            }

            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient.rpc('reject_student_registration', {
                        p_student_record_id: student.studentRecordId,
                        p_review_remarks: remarks || null
                    });
                    if (error) throw error;
                } catch (error) {
                    console.error('Failed to reject student registration:', error);
                    showToast(error.message || 'Could not reject this student in Supabase.', 'error');
                    return;
                }
            }

            student.registrationStatus = 'Rejected';
            student.reviewRemarks = remarks;
            student.reviewedAt = new Date().toISOString();
            saveData();
            renderStaffRegistrations();
            renderStaffQueue();
            renderAdminRoster();
            renderStudentSelector();
            showToast('Student registration rejected.', 'info');
        }

        function getRuleChecks(student, sub) {
            const rule = policyRules[student.program] || policyRules['Merit Scholar'];
            return [
                { name: 'GWA Permitted', val: sub.gwa.toFixed(2), limit: `≤ ${rule.maxGwa}`, pass: sub.gwa <= rule.maxGwa },
                { name: 'Enrolled Units', val: sub.units, limit: `≥ ${rule.minUnits}`, pass: sub.units >= rule.minUnits },
                { name: 'Failed Subjects', val: sub.failed, limit: `≤ ${rule.maxFailed}`, pass: sub.failed <= rule.maxFailed },
                { name: 'Incomplete Grades (INC)', val: sub.inc, limit: `≤ ${rule.maxInc}`, pass: sub.inc <= rule.maxInc },
                { name: 'Dropped Subjects', val: sub.dropped, limit: `≤ ${rule.maxDropped}`, pass: sub.dropped <= rule.maxDropped }
            ];
        }

        function openReviewModal(studentId, subId) {
            activeReviewSubId = subId;
            const student = appData.find(s => s.id === studentId);
            if (!student) return;
            const sub = student.submissions.find(s => s.id === subId);
            if (!sub) return;

            document.getElementById('rev-student-name').innerText = student.name;
            document.getElementById('rev-student-id').innerText = student.id;
            document.getElementById('rev-student-program').innerText = student.program;
            document.getElementById('rev-submitted-at').innerText = formatDateTime(sub.submittedAt);
            document.getElementById('rev-doc-link').href = sub.docRef;
            document.getElementById('rev-doc-text').innerText = sub.docRef;
            document.getElementById('rev-student-notes').innerText = sub.notes || 'No notes provided.';
            document.getElementById('rev-staff-remarks').value = sub.staffRemarks || '';

            const isLate = new Date(sub.submittedAt).getTime() > DEADLINE_TIMESTAMP;
            const timingBadge = document.getElementById('rev-timing-badge');
            if (isLate) {
                timingBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800';
                timingBadge.innerText = 'Late Submission';
            } else {
                timingBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800';
                timingBadge.innerText = 'On Time';
            }

            setRadioValue('rev-verify', sub.verificationStatus === 'Pending' ? 'Verified' : sub.verificationStatus);
            setRadioValue('rev-compliance', sub.complianceStatus === 'Pending Evaluation' ? 'Compliant' : sub.complianceStatus);
            setRadioValue('rev-renewal', sub.renewalDecision === 'Pending Decision' ? 'Approved' : sub.renewalDecision);

            const tbody = document.getElementById('rev-rule-breakdown');
            tbody.innerHTML = '';

            const checks = getRuleChecks(student, sub);

            let hasDeficiency = false;
            checks.forEach(c => {
                if (!c.pass) hasDeficiency = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="p-2 font-medium text-slate-700">${c.name}</td>
                    <td class="p-2">${c.val}</td>
                    <td class="p-2 text-slate-500">${c.limit}</td>
                    <td class="p-2 text-center">${c.pass ? '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> Pass</span>' : '<span class="text-rose-600 font-bold"><i class="fa-solid fa-circle-xmark"></i> Fail</span>'}</td>
                `;
                tbody.appendChild(tr);
            });

            if (sub.complianceStatus === 'Pending Evaluation') {
                setRadioValue('rev-compliance', hasDeficiency ? 'With Deficiency' : 'Compliant');
            }

            toggleModal('review-modal', true);
        }

        async function saveStaffEvaluation() {
            let foundStudent = null;
            let foundSub = null;

            appData.forEach(student => {
                student.submissions.forEach(sub => {
                    if (sub.id === activeReviewSubId) {
                        foundStudent = student;
                        foundSub = sub;
                    }
                });
            });

            if (!foundSub) return;

            const verifyVal = getRadioValue('rev-verify');
            const complianceVal = getRadioValue('rev-compliance');
            const renewalVal = getRadioValue('rev-renewal');
            const remarks = document.getElementById('rev-staff-remarks').value;
            const isAcademicallyQualified = getRuleChecks(foundStudent, foundSub).every(check => check.pass);

            if (complianceVal === 'Compliant' && !isAcademicallyQualified) {
                showToast('Cannot mark this student compliant: one or more academic requirements are not met.', 'error');
                return;
            }

            if (renewalVal === 'Approved') {
                if (verifyVal !== 'Verified') {
                    showToast('Cannot approve renewal: Submission is not Verified!', 'error');
                    return;
                }
                if (complianceVal !== 'Compliant' || !isAcademicallyQualified) {
                    showToast('Cannot approve renewal: Student has academic deficiencies!', 'error');
                    return;
                }
            }

            if (supabaseClient) {
                let error;
                try {
                    ({ error } = await supabaseClient
                        .from('submissions')
                        .update({
                            verification_status: verifyVal,
                            compliance_status: complianceVal,
                            renewal_decision: renewalVal,
                            remarks
                        })
                        .eq('id', foundSub.id));
                } catch (requestError) {
                    console.error('Failed to save staff evaluation to Supabase:', requestError);
                    showToast('Evaluation could not be saved because Supabase could not be reached.', 'error');
                    return;
                }

                if (error) {
                    console.error('Failed to save staff evaluation to Supabase:', error);
                    showToast('Evaluation could not be saved to Supabase.', 'error');
                    return;
                }
            }

            foundSub.verificationStatus = verifyVal;
            foundSub.complianceStatus = complianceVal;
            foundSub.renewalDecision = renewalVal;
            foundSub.staffRemarks = remarks;

            saveData();
            showToast('Evaluation decision recorded successfully!', 'success');
            toggleModal('review-modal', false);
            renderStaffQueue();
        }

        function renderAdminDashboard() {
            let totalScholars = appData.length;
            let totalSubmissions = 0;
            let verifiedCount = 0;
            let compliantCount = 0;
            let approvedCount = 0;

            let statusCounts = { Approved: 0, Held: 0, Pending: 0, Returned: 0 };

            appData.forEach(s => {
                totalSubmissions += s.submissions.length;
                s.submissions.forEach(sub => {
                    if (sub.verificationStatus === 'Verified') verifiedCount++;
                    if (sub.complianceStatus === 'Compliant') compliantCount++;
                    if (sub.renewalDecision === 'Approved') approvedCount++;

                    if (sub.renewalDecision === 'Approved') statusCounts.Approved++;
                    else if (sub.renewalDecision === 'Held') statusCounts.Held++;
                    else statusCounts.Pending++;
                });
            });

            document.getElementById('admin-stat-total').innerText = totalScholars;
            const verifyRate = totalSubmissions > 0 ? Math.round((verifiedCount / totalSubmissions) * 100) : 0;
            const complianceRate = totalSubmissions > 0 ? Math.round((compliantCount / totalSubmissions) * 100) : 0;

            document.getElementById('admin-stat-verified-rate').innerText = `${verifyRate}%`;
            document.getElementById('admin-stat-compliance-rate').innerText = `${complianceRate}%`;
            document.getElementById('admin-stat-approved').innerText = approvedCount;

            renderAdminRoster();
            renderAdminChart(statusCounts);
        }

        function renderAdminRoster() {
            const tbody = document.getElementById('admin-roster-tbody');
            tbody.innerHTML = '';

            if (appData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400">No students are registered yet.</td></tr>';
                return;
            }

            appData.forEach(student => {
                const latest = student.submissions[student.submissions.length - 1];
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 border-b border-slate-100";
                tr.innerHTML = `
                    <td class="p-3 font-semibold text-slate-800">${escapeHtml(student.id)}</td>
                    <td class="p-3">${escapeHtml(student.name)}</td>
                    <td class="p-3">${getStatusPill(student.registrationStatus)}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-800 font-medium">${escapeHtml(student.program)}</span></td>
                    <td class="p-3">${latest ? getStatusPill(latest.verificationStatus) : '<span class="text-slate-400">No Sub</span>'}</td>
                    <td class="p-3">${latest ? getStatusPill(latest.complianceStatus) : '<span class="text-slate-400">No Sub</span>'}</td>
                    <td class="p-3">${latest ? getStatusPill(latest.renewalDecision) : '<span class="text-slate-400">No Sub</span>'}</td>
                    <td class="p-3 text-right text-slate-400 font-mono text-[10px]">${escapeHtml(student.studentRecordId || `SYS-${student.id.replace('-', '')}`)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function createStudent(event) {
            event.preventDefault();
            const studentId = document.getElementById('new-student-id').value.trim();
            const fullName = document.getElementById('new-student-name').value.trim();
            const email = document.getElementById('new-student-email').value.trim().toLowerCase();

            if (appData.some(student => student.id.toLowerCase() === studentId.toLowerCase())) {
                showToast('A student with this ID is already registered.', 'error');
                return;
            }

            if (!fullName || !studentId) {
                showToast('Student ID and full name are required.', 'error');
                return;
            }

            let studentRecordId = `local-${Date.now()}`;
            if (supabaseClient) {
                try {
                    const { data, error } = await supabaseClient.rpc('create_student_record', {
                        p_email: email || null,
                        p_full_name: fullName,
                        p_program_name: null,
                        p_student_id_number: studentId
                    });
                    if (error) throw error;
                    studentRecordId = data;
                } catch (error) {
                    console.error('Failed to register student in Supabase:', error);
                    showToast(error.message || 'Could not register student in Supabase.', 'error');
                    return;
                }
            } else {
                if (email && appData.some(student => student.email?.toLowerCase() === email)) {
                    showToast('A student with this email is already registered.', 'error');
                    return;
                }
            }

            appData.push({
                id: studentId,
                studentRecordId,
                name: fullName,
                email,
                program: 'Unassigned Program',
                registrationStatus: 'Pending',
                reviewedAt: null,
                reviewRemarks: '',
                submissions: []
            });
            saveData();
            currentActiveStudentId = studentId;
            document.getElementById('student-create-form').reset();
            switchRole(currentRole);
            showToast('Student registered successfully.', 'success');
        }

        function renderAdminChart(dataCounts) {
            const ctx = document.getElementById('adminAnalyticsChart').getContext('2d');
            if (adminChart) adminChart.destroy();

            adminChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Approved Renewals', 'Held / Deficient', 'Pending Queue'],
                    datasets: [{
                        label: 'Scholars Count',
                        data: [dataCounts.Approved, dataCounts.Held, dataCounts.Pending],
                        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    }
                }
            });
        }

        function populateConfigForm() {
            document.getElementById('cfg-merit-gwa').value = policyRules['Merit Scholar'].maxGwa;
            document.getElementById('cfg-merit-units').value = policyRules['Merit Scholar'].minUnits;
            document.getElementById('cfg-merit-failed').value = policyRules['Merit Scholar'].maxFailed;
            document.getElementById('cfg-merit-inc').value = policyRules['Merit Scholar'].maxInc;
            document.getElementById('cfg-merit-dropped').value = policyRules['Merit Scholar'].maxDropped;
            document.getElementById('cfg-comm-gwa').value = policyRules['Community Scholar'].maxGwa;
            document.getElementById('cfg-comm-units').value = policyRules['Community Scholar'].minUnits;
            document.getElementById('cfg-comm-failed').value = policyRules['Community Scholar'].maxFailed;
            document.getElementById('cfg-comm-inc').value = policyRules['Community Scholar'].maxInc;
            document.getElementById('cfg-comm-dropped').value = policyRules['Community Scholar'].maxDropped;
            const localMode = localStorage.getItem('supabase_mode') === 'local';
            document.getElementById('sp-url').value = localMode
                ? ''
                : localStorage.getItem('supabase_url') || SUPABASE_DEFAULT_URL;
            document.getElementById('sp-key').value = localMode
                ? ''
                : localStorage.getItem('supabase_key') || SUPABASE_DEFAULT_ANON_KEY;
        }

        function renderPolicyCriteria() {
            const criteria = [
                ['student-merit', policyRules['Merit Scholar']],
                ['student-community', policyRules['Community Scholar']]
            ];

            criteria.forEach(([prefix, rule]) => {
                document.getElementById(`${prefix}-max-gwa`).innerText = rule.maxGwa;
                document.getElementById(`${prefix}-min-units`).innerText = `${rule.minUnits} units`;
                document.getElementById(`${prefix}-max-failed`).innerText = rule.maxFailed;
                document.getElementById(`${prefix}-max-inc`).innerText = rule.maxInc;
                document.getElementById(`${prefix}-max-dropped`).innerText = rule.maxDropped;
            });
        }

        async function handleConfigUpdate(e) {
            e.preventDefault();
            const updatedRules = {
                'Merit Scholar': {
                    maxGwa: Number(document.getElementById('cfg-merit-gwa').value),
                    minUnits: Number(document.getElementById('cfg-merit-units').value),
                    maxFailed: Number(document.getElementById('cfg-merit-failed').value),
                    maxInc: Number(document.getElementById('cfg-merit-inc').value),
                    maxDropped: Number(document.getElementById('cfg-merit-dropped').value)
                },
                'Community Scholar': {
                    maxGwa: Number(document.getElementById('cfg-comm-gwa').value),
                    minUnits: Number(document.getElementById('cfg-comm-units').value),
                    maxFailed: Number(document.getElementById('cfg-comm-failed').value),
                    maxInc: Number(document.getElementById('cfg-comm-inc').value),
                    maxDropped: Number(document.getElementById('cfg-comm-dropped').value)
                }
            };

            const validRules = Object.values(updatedRules).every(rule =>
                Number.isFinite(rule.maxGwa) && rule.maxGwa >= 1 && rule.maxGwa <= 5 &&
                Number.isInteger(rule.minUnits) && rule.minUnits >= 0 &&
                Number.isInteger(rule.maxFailed) && rule.maxFailed >= 0 &&
                Number.isInteger(rule.maxInc) && rule.maxInc >= 0 &&
                Number.isInteger(rule.maxDropped) && rule.maxDropped >= 0
            );

            if (!validRules) {
                showToast('Enter a GWA from 1 to 5 and non-negative whole numbers for the other criteria.', 'error');
                return;
            }

            if (supabaseClient) {
                const rows = Object.entries(updatedRules).map(([programName, rule]) => ({
                    program_name: programName,
                    max_gwa: rule.maxGwa,
                    min_units: rule.minUnits,
                    max_failed: rule.maxFailed,
                    max_inc: rule.maxInc,
                    max_dropped: rule.maxDropped,
                    updated_at: new Date().toISOString()
                }));

                try {
                    const { error } = await supabaseClient
                        .from('scholarship_policy_rules')
                        .upsert(rows, { onConflict: 'program_name' });
                    if (error) throw error;
                } catch (error) {
                    console.error('Failed to save policy rules to Supabase:', error);
                    showToast(error.message || 'Policy rules could not be saved to Supabase.', 'error');
                    return;
                }
            }

            policyRules = updatedRules;
            localStorage.setItem('scholar_policy_rules', JSON.stringify(policyRules));
            renderPolicyCriteria();
            populateConfigForm();
            showToast('Policy rules updated successfully!', 'success');
        }

        function exportSummaryCSV() {
            let csvContent = "data:text/csv;charset=utf-8,Student ID,Student Name,Program,GWA,Units,Verification Status,Compliance Status,Renewal Decision\n";
            appData.forEach(s => {
                const sub = s.submissions[s.submissions.length - 1];
                if (sub) {
                    csvContent += `"${s.id}","${s.name}","${s.program}","${sub.gwa}","${sub.units}","${sub.verificationStatus}","${sub.complianceStatus}","${sub.renewalDecision}"\n`;
                }
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "Scholarship_Compliance_Report_2026.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        async function resetSystemData() {
            if (supabaseClient) {
                if (!confirm('Reload current Supabase records? This will not modify database data.')) return;

                try {
                    await loadScholarData();
                    switchRole(currentRole);
                    showToast('Supabase data reloaded. Database records were not changed.', 'info');
                } catch (error) {
                    console.error('Failed to reload scholarship data from Supabase:', error);
                    showToast('Could not reload Supabase data.', 'error');
                }
                return;
            }

            if (confirm("Reset all data to default mock values?")) {
                localStorage.removeItem('scholar_system_data');
                loadInitialData();
                renderAdminDashboard();
                showToast('System data reset to initial values.', 'info');
            }
        }

        function saveSupabaseConfig() {
            const url = document.getElementById('sp-url').value.trim();
            const key = document.getElementById('sp-key').value.trim();
            if (url && key) {
                localStorage.setItem('supabase_url', url);
                localStorage.setItem('supabase_key', key);
                localStorage.setItem('supabase_mode', 'supabase');
                initializeSupabase(url, key);
                loadScholarData().then(() => {
                    switchRole(currentRole);
                    showToast('Connected to Supabase.', 'success');
                    toggleModal('supabase-modal', false);
                }).catch(error => {
                    console.error('Failed to connect to Supabase:', error);
                    setSupabaseStatus('Supabase connection failed', 'text-rose-600');
                    showToast('Could not connect to Supabase. Verify the URL, key, schema, and access policies.', 'error');
                });
            } else {
                localStorage.removeItem('supabase_url');
                localStorage.removeItem('supabase_key');
                localStorage.setItem('supabase_mode', 'local');
                supabaseClient = null;
                loadInitialData();
                setSupabaseStatus('Local Storage Mode', 'text-emerald-600');
                switchRole(currentRole);
                showToast('Switched to Local Storage Mode.', 'info');
                toggleModal('supabase-modal', false);
            }
        }

        function getStatusPill(status) {
            switch (status) {
                case 'Verified':
                case 'Compliant':
                case 'Approved':
                case 'Confirmed':
                    return `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-check-circle text-[9px] mr-1"></i>${status}</span>`;
                case 'Returned':
                case 'With Deficiency':
                case 'Held':
                case 'Rejected':
                    return `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800"><i class="fa-solid fa-triangle-exclamation text-[9px] mr-1"></i>${status}</span>`;
                default:
                    return `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800"><i class="fa-solid fa-spinner text-[9px] mr-1"></i>${status}</span>`;
            }
        }

        function toggleModal(id, show) {
            const modal = document.getElementById(id);
            if (show) modal.classList.remove('hidden');
            else modal.classList.add('hidden');
        }

        function formatDateTime(isoString) {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function getInitials(name) {
            return name.split(' ').map(n => n[0]).join('');
        }

        function setRadioValue(name, val) {
            const radios = document.getElementsByName(name);
            radios.forEach(r => { if (r.value === val) r.checked = true; });
        }

        function getRadioValue(name) {
            const radios = document.getElementsByName(name);
            for (let r of radios) {
                if (r.checked) return r.value;
            }
            return '';
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const color = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-800';
            toast.className = `${color} text-white text-xs px-4 py-3 rounded-xl shadow-lg flex items-center justify-between pointer-events-auto transition transform duration-300 translate-y-2`;
            toast.innerHTML = `
                <span>${message}</span>
                <button onclick="this.parentElement.remove()" class="ml-3 text-white/80 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            `;
            container.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 4000);
        }
