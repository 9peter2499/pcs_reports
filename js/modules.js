// =================================================================
// PCS Test Case - Modules Overview Script (Debug & Fix Version)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('modules-container');
    const loadingState = document.getElementById('loading-state');

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client missing');
            return;
        }
        await loadModulesData();
    }

    // --- 2. Data Fetching & Processing ---
    async function loadModulesData() {
        try {
            console.log('--- Starting Data Load ---');

            // 1. ดึง Master Modules (12 ระบบ)
            const { data: modules, error: modError } = await supabaseClient
                .from('Modules')
                .select('module_id, module_name')
                .order('module_id');
            if (modError) throw modError;
            console.log(`Loaded ${modules.length} Modules`);

            // 2. ดึง TORs ทั้งหมด
            const { data: torsData, error: torError } = await supabaseClient
                .from('TORs')
                .select('module_id, tor_id');
            if (torError) throw torError;
            console.log(`Loaded ${torsData.length} TORs`);

            // 3. ดึง View Data (หัวใจสำคัญ)
            // เพิ่ม field 'module_group' หรือที่ใกล้เคียงเผื่อใช้ Cross check
            const { data: viewData, error: viewError } = await supabaseClient
                .from('test_case_report_view')
                .select('tor_id, test_case_id, scenario_id, module_group'); 
            if (viewError) throw viewError;
            console.log(`Loaded ${viewData.length} View Rows`);

            // --- เริ่มกระบวนการนับ ---

            // Map: TOR_ID -> MODULE_ID
            const torToModuleMap = {};
            const torCountMap = {}; 

            torsData.forEach(t => {
                if (t.module_id) {
                    const mid = String(t.module_id);
                    torToModuleMap[t.tor_id] = mid;
                    
                    if (!torCountMap[mid]) torCountMap[mid] = new Set();
                    torCountMap[mid].add(t.tor_id);
                }
            });

            // Map: MODULE_ID -> Stats
            const statsMap = new Map();
            
            // วนลูป View Data เพื่อจัดลงถัง
            viewData.forEach(row => {
                let mid = null;

                // Priority 1: หาจาก TOR ที่ผูกไว้
                if (row.tor_id && torToModuleMap[row.tor_id]) {
                    mid = torToModuleMap[row.tor_id];
                } 
                // Priority 2: หาจาก module_group ใน view (ถ้ามี และหาจาก TOR ไม่เจอ)
                else if (row.module_group) {
                    mid = String(row.module_group);
                }

                // ถ้าหา Module ไม่เจอ ข้าม
                if (!mid) return;

                if (!statsMap.has(mid)) {
                    statsMap.set(mid, { tcs: new Set(), scenarios: new Set() });
                }

                const entry = statsMap.get(mid);
                if (row.test_case_id) entry.tcs.add(row.test_case_id);
                if (row.scenario_id) entry.scenarios.add(row.scenario_id);
            });

            // Debug Module 01 specifically
            const mod01Stats = statsMap.get('01');
            if (mod01Stats) {
                console.log('--- Debug Module 01 ---');
                console.log('Test Cases:', mod01Stats.tcs.size);
                console.log('Scenarios:', mod01Stats.scenarios.size);
            }

            // 4. ประกอบร่างข้อมูลเข้า Card
            const modulesWithStats = modules.map(mod => {
                const mid = String(mod.module_id);
                const stats = statsMap.get(mid) || { tcs: new Set(), scenarios: new Set() };
                
                return {
                    ...mod,
                    torCount: torCountMap[mid] ? torCountMap[mid].size : 0,
                    tcCount: stats.tcs.size,
                    scenarioCount: stats.scenarios.size
                };
            });

            renderModules(modulesWithStats);

        } catch (err) {
            console.error('Error loading modules:', err);
            if(container) container.innerHTML = `<div class="col-12 text-center text-danger">Error loading data: ${err.message}</div>`;
            if(loadingState) loadingState.style.display = 'none';
        }
    }

    // --- 3. Rendering (Logic เดิม) ---
    function renderModules(modules) {
        if(!container) return;
        container.innerHTML = '';
        if(loadingState) loadingState.style.display = 'none';
        container.style.display = 'flex';

        const colors = ['#3f6ad8'];

        modules.forEach((mod, index) => {
            const color = colors[index % colors.length];
            
            // Icon Logic
            let iconClass = 'bi-folder';
            const name = (mod.module_name || '').toLowerCase();
            if (name.includes('เรือ') || name.includes('vessel')) iconClass = 'bi-folder';
            else if (name.includes('นำเข้า') || name.includes('import')) iconClass = 'bi-box-arrow-in-down';
            else if (name.includes('ส่งออก') || name.includes('export')) iconClass = 'bi-box-arrow-up';
            else if (name.includes('ศุลกากร') || name.includes('customs')) iconClass = 'bi-shield-check';
            else if (name.includes('รถ') || name.includes('ขนส่ง') || name.includes('truck')) iconClass = 'bi-truck';
            else if (name.includes('ราง') || name.includes('rail')) iconClass = 'bi-train-front';
            else if (name.includes('บริหาร') || name.includes('admin')) iconClass = 'bi-gear-wide-connected';
            else if (name.includes('general') || name.includes('ทั่วไป')) iconClass = 'bi-grid';

            const torClass = mod.torCount > 0 ? '' : 'opacity-50';
            const tcClass = mod.tcCount > 0 ? '' : 'opacity-50';
            const scClass = mod.scenarioCount > 0 ? '' : 'opacity-50';

            // HTML Structure
            const html = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="folder-card" style="border-left-color: ${color};">
                        
                        <div class="folder-header">
                            <div class="folder-title" title="${mod.module_name}">
                                ${mod.module_name}
                            </div>
                            <i class="bi ${iconClass} module-icon" style="color: ${color};"></i>
                        </div>

                        <div class="stats-container">
                            <div class="stat-item ${torClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู TOR ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.torCount}</div>
                                <div class="stat-label">TORs</div>
                            </div>
                            <div class="stat-item border-start border-end ${tcClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู Test Case ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.tcCount}</div>
                                <div class="stat-label">Test Cases</div>
                            </div>
                            <div class="stat-item ${scClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู Scenario ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.scenarioCount}</div>
                                <div class="stat-label">Scenarios</div>
                            </div>
                        </div>

                        <div class="folder-footer">
                            <button class="btn-action-icon" title="Download Excel" onclick="exportToExcel('${mod.module_id}')">
                                <i class="bi bi-file-earmark-excel"></i>
                            </button>
                        </div>

                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }

    // Navigation
    window.redirectToTorPage = (moduleId) => {
        const filterState = { module: moduleId, search: '' };
        sessionStorage.setItem('torwtcFilters', JSON.stringify(filterState));
        window.location.href = '/torwtc.html';
    };
    
    // (ฟังก์ชัน exportToExcel ต้องมีอยู่แล้ว หรือถ้าไม่มีก็แปะเพิ่มได้ครับ)

    init();
});

// =================================================================
// EXPORT EXCEL MODULE (Place this at the bottom of your script file)
// =================================================================

// 1. Helper: แปลง HTML เป็น Text (สำหรับล้าง tag <br>, <p> ออก)
function formatHtmlToExcel(html) {
    if (!html) return "";
    let text = html.toString()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
    let tmp = document.createElement("DIV");
    tmp.innerHTML = text;
    return (tmp.textContent || tmp.innerText || "").trim();
}

// 2. Helper: แสดง Loading เต็มหน้าจอ
function showLoadingOverlay() {
    let overlay = document.getElementById('excel-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'excel-loading-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
        overlay.innerHTML = `
            <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
            <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
            <div style="margin-top: 5px; opacity: 0.8;">กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูล</div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

// 3. Helper: ซ่อน Loading
function hideLoadingOverlay() {
    const overlay = document.getElementById('excel-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// 4. Main Function: Export to Excel (V6.1 Fix Mapping)
async function exportToExcel(moduleId) {
    if (!moduleId) return alert("ไม่พบ Module ID");

    // เรียกใช้ Helper ที่ประกาศไว้ด้านบน
    showLoadingOverlay();

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCS System';
        workbook.created = new Date();

        // --- MAPPING ชื่อไฟล์ให้ถูกต้อง ---
        const fileNameMapping = {
            '01': 'General', 'M01': 'General', 'M001': 'General',
            '02': 'Vessel', 'M02': 'Vessel', 'M002': 'Vessel',
            '03': 'Import', 'M03': 'Import', 'M003': 'Import',
            '04': 'Customs', 'M04': 'Customs', 'M004': 'Customs',
            '05': 'Export', 'M05': 'Export', 'M005': 'Export',
            '06': 'Container', 'M06': 'Container', 'M006': 'Container',
            '07': 'Hinterland', 'M07': 'Hinterland', 'M007': 'Hinterland',
            '08': 'Banking', 'M08': 'Banking', 'M008': 'Banking',
            '09': 'PCSIntelligence', 'M09': 'PCSIntelligence', 'M009': 'PCSIntelligence',
            '10': 'SetupUtility', 'M10': 'SetupUtility', 'M010': 'SetupUtility',
            '11': 'Administration', 'M11': 'Administration', 'M011': 'Administration',
            '12': 'Report', 'M12': 'Report', 'M012': 'Report'
        };

        let fileModuleName = fileNameMapping[moduleId] || `Module-${moduleId}`;

        // --- 1. Query TORs ---
        const { data: tors, error: torError } = await supabaseClient
            .from('TORs')
            .select('*')
            .eq('module_id', moduleId)
            .order('tor_id');

        if (torError) throw torError;
        if (!tors || tors.length === 0) throw new Error("ไม่พบข้อมูล TOR ใน Module นี้");

        // --- 2. Loop Create Sheets ---
        for (const tor of tors) {
            // Get Detail
            const { data: torDetail } = await supabaseClient
                .from('TORDetail')
                .select('tord_header, tord_prototype')
                .eq('tor_id', tor.tor_id)
                .maybeSingle();

            // Sheet Name
            let sheetName = tor.tor_name ? tor.tor_name.split(' ')[0] : tor.tor_id;
            sheetName = sheetName.replace(/[\/\\\?\*\[\]]/g, '_').substring(0, 31);
            const worksheet = workbook.addWorksheet(sheetName);

            // Get Test Cases
            let { data: testData } = await supabaseClient
                .from('tor_test_case_links')
                .select(`
                    test_cases (
                        id, test_id_code, name, pcs_module_id,
                        pcs_module:pcs_module_id ( name ), 
                        scenarios (
                            id, scenario_id_code, name, action, expected_result, information
                        )
                    )
                `)
                .eq('tor_id', tor.tor_id);
            
            // Sort Data
            if (testData) {
                testData.sort((a, b) => {
                    const moduleNameA = a.test_cases?.pcs_module?.name || "";
                    const moduleNameB = b.test_cases?.pcs_module?.name || "";
                    if (moduleNameA < moduleNameB) return -1;
                    if (moduleNameA > moduleNameB) return 1;
                    return (a.test_cases?.test_id_code || "").localeCompare(b.test_cases?.test_id_code || "");
                });
            }

            // Prepare Header Info
            let pcsModuleName = "Unknown - Unknown";
            if (testData && testData.length > 0 && testData[0].test_cases?.pcs_module?.name) {
                pcsModuleName = testData[0].test_cases.pcs_module.name;
            }

            const nameParts = pcsModuleName.split('-');
            let moduleNameHeader = "-";
            let functionNameHeader = "-";

            if (pcsModuleName.startsWith("Co-Service")) {
                moduleNameHeader = "Co-Service";
                if (nameParts.length > 2) functionNameHeader = nameParts.slice(2).join('-').trim();
            } else {
                moduleNameHeader = nameParts[0] ? nameParts[0].trim() : "-";
                functionNameHeader = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "-";
            }

            // Set Columns
            worksheet.getColumn('A').width = 35; worksheet.getColumn('B').width = 50; 
            worksheet.getColumn('C').width = 15; worksheet.getColumn('D').width = 50; 
            worksheet.getColumn('E').width = 50; worksheet.getColumn(6).width = 8;
            worksheet.getColumn(7).width = 8; worksheet.getColumn(8).width = 10;
            worksheet.getColumn(9).width = 15; worksheet.getColumn(10).width = 30;

            // Write Headers
            const headerRows = [
                ['Project Name :', 'Port Community System, PORT Authority of Thailand'],
                ['Application Name :', 'Port Community System'],
                ['Module :', moduleNameHeader], 
                ['Function :', functionNameHeader],
                ['Path :', pcsModuleName]
            ];

            headerRows.forEach((data, index) => {
                const row = worksheet.getRow(index + 1);
                row.getCell(1).value = data[0]; row.getCell(2).value = data[1];
                const cellA = row.getCell(1);
                cellA.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cellA.alignment = { vertical: 'top' };
                row.getCell(2).alignment = { vertical: 'top', wrapText: true };
            });

            // Write Detail Row (Row 6)
            const row6 = worksheet.getRow(6);
            row6.getCell(1).value = 'Test ID/NAME :';
            row6.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            row6.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
            row6.getCell(1).alignment = { vertical: 'top' };
            
            row6.getCell(2).value = tor.tor_name || "-";
            row6.getCell(2).alignment = { vertical: 'top', wrapText: true };
            
            row6.getCell(3).value = "สัมพันธ์กับ";
            row6.getCell(3).font = { bold: true };
            row6.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };
            
            row6.getCell(4).value = { richText: [{ text: 'Detail Design\n', font: { bold: true } }, { text: formatHtmlToExcel(torDetail?.tord_header) }] };
            row6.getCell(4).alignment = { vertical: 'top', wrapText: true };
            
            row6.getCell(5).value = { richText: [{ text: 'Prototype\n', font: { bold: true } }, { text: formatHtmlToExcel(torDetail?.tord_prototype) }] };
            row6.getCell(5).alignment = { vertical: 'top', wrapText: true };

            // Table Header (Row 8)
            const headerRow = worksheet.addRow(['Test Case Name', 'Test Case Function', 'Test Step #', 'Action', 'Expected Result', 'Pass', 'Fail', 'Not Run', 'Test By', 'Remark / Fail Detail']);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // Write Data
            if (testData) {
                testData.forEach(link => {
                    const tc = link.test_cases;
                    if (!tc || !tc.scenarios) return;
                    tc.scenarios.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));

                    let isFirstScenario = true;
                    tc.scenarios.forEach((sc, idx) => {
                        const row = worksheet.addRow([]);
                        if (isFirstScenario) {
                            const moduleNameTitle = tc.pcs_module?.name || "-"; 
                            row.getCell(1).value = { richText: [{ text: moduleNameTitle + '\n', font: { bold: true } }, { text: (tc.test_id_code || "") + ' :\n', font: { bold: true } }, { text: (tc.name || ""), font: { bold: false } }] };
                        }
                        
                        let sessionPrefix = "";
                        const scCode = (sc.scenario_id_code || "").trim();
                        if (scCode.startsWith("ST")) sessionPrefix = "SIT Session\n";
                        else if (scCode.startsWith("UT")) sessionPrefix = "UAT Session\n";

                        row.getCell(2).value = { richText: [{ text: sessionPrefix, font: { bold: true } }, { text: scCode + ' :\n', font: { bold: true } }, { text: (sc.name || ""), font: { bold: false } }] };
                        row.getCell(3).value = idx + 1;
                        row.getCell(4).value = formatHtmlToExcel(sc.action);
                        row.getCell(5).value = formatHtmlToExcel(sc.expected_result);
                        row.getCell(10).value = formatHtmlToExcel(sc.information);

                        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                            if (colNum > 10) return;
                            cell.alignment = { vertical: 'top', wrapText: true };
                            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                            if ([3, 6, 7, 8].includes(colNum)) cell.alignment = { vertical: 'top', horizontal: 'center' };
                        });
                        isFirstScenario = false;
                    });
                });
            }
        }

        // --- Download ---
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const safeModuleName = fileModuleName.replace(/[^a-zA-Z0-9]/g, ''); 
        const fileName = `Test Case-${safeModuleName}-${timestamp}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, fileName);

    } catch (err) {
        console.error('Export Error:', err);
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        hideLoadingOverlay();
    }
}