// --- GLOBAL VARIABLES ---
let statusPieChartInstance = null;
let phaseBarChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabaseClient === 'undefined') {
        console.error('Error: "supabaseClient" not found. Please check if supabase-client.js is loaded correctly.');
        return;
    }

    await initDashboard();

    // Event Listeners for Filters
    const companyFilter = document.getElementById('dashboard-company-filter');
    const phaseFilter = document.getElementById('dashboard-phase-filter');
    const moduleFilter = document.getElementById('dashboard-module-filter');

    // Helper func to get current values
    const getFilters = () => ({
        company: companyFilter ? companyFilter.value : 'all',
        phase: phaseFilter ? phaseFilter.value : 'all',
        module: moduleFilter ? moduleFilter.value : 'all'
    });

    // Attach listeners
    [companyFilter, phaseFilter, moduleFilter].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                const f = getFilters();
                loadDashboardData(f.company, f.phase, f.module);
            });
        }
    });
});

async function initDashboard() {
    if (!supabaseClient || !supabaseClient.auth) return;

    // Check User
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) console.warn('User not logged in');

    // Admin Check
    const isAdmin = true;
    if (isAdmin) {
        document.getElementById('admin-filter-container')?.classList.remove('d-none');
        await Promise.all([
            loadCompanyOptions(),
            loadPhaseOptions(),
            loadModuleOptions() // ✨ โหลด Modules ใหม่
        ]);
    }

    // Load Data (Default: All)
    await loadDashboardData('all', 'all', 'all');
}

async function loadCompanyOptions() {
    try {
        const { data: companies } = await supabaseClient.from('company').select('company_id, company_name').order('company_id');
        const select = document.getElementById('dashboard-company-filter');
        if (companies && select) {
            companies.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.company_id;
                opt.textContent = c.company_name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error loading companies', e); }
}

async function loadPhaseOptions() {
    try {
        const { data: phases } = await supabaseClient.from('test_phases').select('id, name').order('display_order');
        const select = document.getElementById('dashboard-phase-filter');
        if (phases && select) {
            phases.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error loading phases', e); }
}

// ✨ ฟังก์ชันโหลด Modules
async function loadModuleOptions() {
    try {
        // ดึงจาก Table "Modules" ตาม Schema ใหม่
        const { data: modules } = await supabaseClient.from('Modules').select('module_id, module_name').order('module_id');
        const select = document.getElementById('dashboard-module-filter');
        if (modules && select) {
            modules.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.module_id;
                opt.textContent = m.module_name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error loading modules', e); }
}

async function loadDashboardData(companyFilter = 'all', phaseFilter = 'all', moduleFilter = 'all') {
    try {
        await fetchScopeStats(companyFilter, phaseFilter, moduleFilter);

        // ✅ CHANGE 3: เพิ่ม TORs!inner(module_id) ใน nested select
        let query = supabaseClient
            .from('scenarios')
            .select(`
                *,
                test_cases!inner (
                    id,
                    test_id_code,
                    name,
                    test_phase_id,
                    pcs_module_id,
                    pcs_module:pcs_module_id ( name, module_code ),
                    company_test_case_links ( company_id ),
                    TORs!inner ( module_id )
                )
            `);

        if (phaseFilter !== 'all') {
            query = query.eq('test_cases.test_phase_id', phaseFilter);
        }
        
        // ✅ CHANGE 4: Filter ผ่านสะพาน TORs
        if (moduleFilter !== 'all') {
            query = query.eq('test_cases.TORs.module_id', moduleFilter);
        }
        
        if (companyFilter !== 'all') {
            query = query.eq('test_cases.company_test_case_links.company_id', companyFilter);
        }

        const { data: scenarioData, error } = await query;
        if (error) throw error;

        // ... (Logic เดิมต่อจากนี้ใช้ได้เลย ไม่ต้องแก้) ...
        let filteredData = scenarioData;
        if (companyFilter !== 'all') {
            filteredData = scenarioData.filter(s => 
                s.test_cases?.company_test_case_links?.some(link => String(link.company_id) === String(companyFilter))
            );
        }

        calculateExecutionStats(filteredData);
        calculateFixTypes(filteredData);
        renderFailedTable(filteredData);

    } catch (err) {
        console.error('Error loading dashboard data:', err.message);
    }
}

async function fetchScopeStats(companyFilter, phaseFilter, moduleFilter) {
    if (companyFilter !== 'all' || phaseFilter !== 'all' || moduleFilter !== 'all') {
        try {
            // ✅ CHANGE 1: เพิ่ม TORs!inner(module_id) เข้าไปใน select เพื่อให้ filter ได้
            let query = supabaseClient.from('test_cases').select(`
                id,
                tor_id,
                pcs_module_id,
                test_phase_id,
                scenarios (id),
                company_test_case_links (company_id),
                TORs!inner ( module_id ) 
            `);

            if (phaseFilter !== 'all') query = query.eq('test_phase_id', phaseFilter);
            
            // ✅ CHANGE 2: เปลี่ยนการ Filter Module ให้ไปเช็คที่ TORs แทน
            if (moduleFilter !== 'all') {
                query = query.eq('TORs.module_id', moduleFilter);
            }

            const { data: tcData, error } = await query;
            if (error) throw error;

            let filteredTC = tcData;
            if (companyFilter !== 'all') {
                filteredTC = tcData.filter(tc => 
                    tc.company_test_case_links?.some(link => String(link.company_id) === String(companyFilter))
                );
            }

            // คำนวณ Stats ตามปกติ
            const uniqueTORs = new Set(filteredTC.map(tc => tc.tor_id).filter(Boolean)).size;
            // หมายเหตุ: uniqueModules ตรงนี้จะนับจำนวน "หน้าจอ (PCS Module)" ที่อยู่ใน Module หลักนั้นๆ
            const uniqueModules = new Set(filteredTC.map(tc => tc.pcs_module_id).filter(Boolean)).size; 
            const objCount = filteredTC.length;
            const scCount = filteredTC.reduce((sum, tc) => sum + (tc.scenarios?.length || 0), 0);

            updateText('stat-tor', uniqueTORs);
            updateText('stat-module', uniqueModules);
            updateText('stat-objective', objCount);
            updateText('stat-scenario', scCount);
        } catch(e) { console.error(e); }
    } else {
        
        const { count: torCount } = await supabaseClient.from('TORs').select('*', { count: 'exact', head: true });
        const { count: moduleCount } = await supabaseClient.from('Modules').select('*', { count: 'exact', head: true });
        const { count: objCount } = await supabaseClient.from('test_cases').select('*', { count: 'exact', head: true });
        const { count: scCount } = await supabaseClient.from('scenarios').select('*', { count: 'exact', head: true });

        updateText('stat-tor', torCount || 0);
        updateText('stat-module', moduleCount || 0);
        updateText('stat-objective', objCount || 0);
        updateText('stat-scenario', scCount || 0);
    }
}

function calculateExecutionStats(data) {
    if (!data) return;

    const assigned = data.length;
    // Executed: มีผลลัพธ์ และไม่ใช่ Pending
    const executedItems = data.filter(d => d.result && d.result !== 'Pending');
    const executedCount = executedItems.length;

    const passedCount = executedItems.filter(d => d.result === 'Pass').length;
    const failedItems = executedItems.filter(d => ['Fail', 'Blocked'].includes(d.result));
    const failedCount = failedItems.length;

    // ✨ NOT RUN: นับรายการที่เป็น Not Run หรือ N/A
    const notRunItems = data.filter(d => d.result === 'Not Run' || d.result === 'N/A');
    const notRunCount = notRunItems.length;

    // ✨ Remaining: ทั้งหมด - (Executed + Not Run)
    // เพราะ Not Run ถือว่า "จบงาน" แล้ว (ตัดสินใจไม่เทส) จึงไม่ควรค้างใน Remaining
    // แต่ถ้า Executed รวม Not Run ไปแล้ว ต้องระวังการนับซ้ำ
    // Logic ปกติ: Executed = (Pass + Fail).  Not Run แยกต่างหาก
    // ดังนั้น Remaining = Assigned - (Pass + Fail + Not Run)
    // หรือ Remaining = Assigned - (ExecutedCount (ถ้า Executed นับเฉพาะ pass/fail) + Not RunCount)
    
    // ปรับ Logic executedItems ใหม่เพื่อให้ชัดเจน:
    // executedItems (Pass/Fail) = executedCount
    // notRunItems = notRunCount
    // remaining = Assigned - executedCount - notRunCount
    
    // เช็คกรณีข้อมูล
    // ถ้า d.result = 'Not Run', มันจะอยู่ใน executedItems ไหม? -> บรรทัด executedItems check result !== 'Pending'.
    // ดังนั้น ถ้า 'Not Run' != 'Pending', มันจะถูกนับเป็น Executed ด้วยใน logic เดิม
    // เราควรแยกให้ชัดเจน:
    
    const trueExecuted = data.filter(d => ['Pass', 'Fail', 'Blocked'].includes(d.result)).length;
    const remainingCount = assigned - trueExecuted - notRunCount;

    let sevCrit = 0, sevMaj = 0, sevMin = 0, sevTriv = 0;
    failedItems.forEach(d => {
        const s = (d.severity || '').toLowerCase();
        if (s.includes('critical')) sevCrit++;
        else if (s.includes('high') || s.includes('major')) sevMaj++;
        else if (s.includes('medium') || s.includes('minor')) sevMin++;
        else sevTriv++;
    });

    updateText('exec-assigned', assigned);
    updateText('exec-executed', trueExecuted); // โชว์เฉพาะที่เทสจริง (Pass/Fail)
    updateText('exec-passed', passedCount);
    updateText('exec-failed', failedCount);
    updateText('exec-notrun', notRunCount); // ✨ อัปเดตตัวเลข Not Run
    updateText('exec-remaining', remainingCount);

    updateText('sev-critical', sevCrit);
    updateText('sev-major', sevMaj);
    updateText('sev-minor', sevMin);
    updateText('sev-trivial', sevTriv);

    // Progress Calculation
    // Base = Assigned - NotRun (เพราะ Not Run ไม่ต้องทำ progress) หรือ Base = Assigned แล้ว Not Run เป็นส่วนหนึ่ง
    // โดยทั่วไปถ้า "ไม่ต้องทำ" ก็คือ 100% ของงานที่ต้องทำเสร็จแล้ว
    // สูตร: Progress = (Pass + Fail + NotRun) / Assigned * 100
    // หรือ Progress = (Pass + Fail) / (Assigned - NotRun) * 100
    
    // ใช้สูตร: Progress รวมทั้งหมดเทียบกับ Assigned
    const percentPass = assigned > 0 ? (passedCount / assigned) * 100 : 0;
    const percentFail = assigned > 0 ? (failedCount / assigned) * 100 : 0;
    const percentNotRun = assigned > 0 ? (notRunCount / assigned) * 100 : 0;
    const percentTotal = percentPass + percentFail + percentNotRun;
    
    const progressEl = document.getElementById('progress-percent');
    if (progressEl) progressEl.textContent = Math.round(percentTotal) + '%';
    
    document.getElementById('prog-bar-pass').style.width = percentPass + '%';
    document.getElementById('prog-bar-fail').style.width = percentFail + '%';
    document.getElementById('prog-bar-notrun').style.width = percentNotRun + '%';
}

function calculateFixTypes(data) {
    const failedItems = data.filter(d => ['Fail', 'Blocked'].includes(d.result));
    let redev = 0, cr = 0, ui = 0, flow = 0;

    failedItems.forEach(d => {
        const fix = (d.fix_type || '').toLowerCase();
        if (fix.includes('development') || fix.includes('bug') || fix.includes('program')) redev++;
        else if (fix.includes('request') || fix.includes('cr')) cr++;
        else if (fix.includes('ui') || fix.includes('ux') || fix.includes('cosmetic')) ui++;
        else if (fix.includes('workflow') || fix.includes('flow')) flow++;
    });

    updateText('fix-redev', redev);
    updateText('fix-cr', cr);
    updateText('fix-ui', ui);
    updateText('fix-flow', flow);
}

function renderFailedTable(data) {
    const tbody = document.getElementById('failed-issues-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const failedItems = data
        .filter(item => ['Fail', 'Blocked'].includes(item.result))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    if (failedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-muted">ไม่พบรายการ Failed ค้างอยู่ในระบบ</td></tr>';
        return;
    }

    failedItems.forEach((item, index) => {
        const testObjName = item.test_cases?.name || '-';
        const testObjCode = item.test_cases?.test_id_code || '';
        const moduleName = item.test_cases?.pcs_module?.name || '-';
        
        const updateDate = new Date(item.updated_at || new Date());
        const today = new Date();
        const diffTime = Math.abs(today - updateDate);
        const daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        let sevBadge = '<span class="badge bg-secondary">Trivial</span>';
        const s = (item.severity || '').toLowerCase();
        if (s.includes('critical')) sevBadge = '<span class="badge bg-danger">Critical</span>';
        else if (s.includes('major')) sevBadge = '<span class="badge bg-warning text-dark">Major</span>';
        else if (s.includes('minor')) sevBadge = '<span class="badge bg-info text-dark">Minor</span>';

        const resultClass = item.result === 'Blocked' ? 'bg-secondary' : 'bg-danger';

        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="fw-medium text-break">${testObjName}</div>
                    <div class="small text-muted">${testObjCode}</div>
                </td>
                <td>${moduleName}</td>
                <td>${updateDate.toLocaleDateString('th-TH')}</td>
                <td class="text-center"><span class="fw-bold text-danger">${daysActive} วัน</span></td>
                <td class="text-center">${sevBadge}</td>
                <td>${item.fix_type || '-'}</td>
                <td><span class="badge ${resultClass}">${item.result}</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value.toLocaleString();
}