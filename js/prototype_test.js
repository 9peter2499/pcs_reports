// =================================================================
// PCS Test Case - Prototype Test Script (Format: Modules.js Style)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL VARIABLES ---
    let reportViewData = []; 
    let allSubModules = []; 
    let allTestPhases = []; 
    let modulePrototypeMap = {}; 

    // DOM Elements
    const reportTableContainer = document.getElementById('report-table-container');
    const reportTableBody = reportTableContainer?.querySelector('tbody');
    
    // Filters
    const moduleFilter = document.getElementById('report-module-filter');
    const subModuleFilter = document.getElementById('report-submodule-filter');
    const phaseFilter = document.getElementById('report-phase-filter');
    const statusFilter = document.getElementById('report-status-filter');

    // --- 1. HELPER FUNCTIONS (จาก Modules.js) ---

    // Helper: แปลง HTML เป็น Text
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

    // Helper: Loading
    function showLoadingOverlay() {
        let overlay = document.getElementById('excel-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'excel-loading-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
            overlay.innerHTML = `
                <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
                <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
                <div style="margin-top: 5px; opacity: 0.8;">กรุณารอสักครู่...</div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('excel-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // Helper: Parse Module Name
    function parseModuleName(fullName) {
        if (!fullName) return { main: '-', sub: '-' };
        const parts = fullName.split('-');
        let main = '', sub = '';
        if (fullName.startsWith('Co-Service')) {
            main = parts.length >= 2 ? parts.slice(0, 2).join('-') : fullName;
            sub = parts.length > 2 ? parts.slice(2).join('-') : '-';
        } else {
            main = parts.length >= 1 ? parts[0] : fullName;
            sub = parts.length > 1 ? parts.slice(1).join('-') : '-';
        }
        return { main: main.trim(), sub: sub ? sub.trim() : '-' };
    }

    // --- 2. DATA FETCHING ---

    async function fetchData() {
        if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5">Loading...</td></tr>`;
        if (typeof supabaseClient === 'undefined') { alert('Initialization Error.'); return []; }
        try {
            // 1. Report Data
            const { data, error } = await supabaseClient
                .from('test_case_report_view')
                .select('*')
                .range(0, 4999)
                .order('overall_row_num', { ascending: true });
            if (error) throw error;

            // 2. Prototype Data
            const { data: modData } = await supabaseClient.from('pcs_module').select('id, prototype_url');
            if (modData) {
                modData.forEach(m => modulePrototypeMap[m.id] = m.prototype_url);
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching data:', error);
            if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-danger">Failed to load data.</td></tr>`;
            return [];
        }
    }

    // --- 4. EXPORT EXCEL (Rich Data & Hyperlink) ---

    window.exportModuleExcel = async (mainModuleGroup) => {
        if (!mainModuleGroup) return;
        
        showLoadingOverlay();

        try {
            // 1. Filter Data เฉพาะ Module Group นี้จากหน้าจอ
            const basicData = reportViewData.filter(r => r.module_group === mainModuleGroup);
            if (basicData.length === 0) throw new Error("No data found for this module.");

            // --- STEP A: PREPARE DATA (Fetch Deep Details) ---
            // เราต้องดึงข้อมูล Action, Expected Result และ TOR Detail มาเพิ่ม เพราะใน View อาจไม่มี หรือไม่ครบ
            
            // 1.1 รวบรวม IDs ที่ต้องใช้
            const scenarioIds = basicData.map(r => r.scenario_id).filter(id => id);
            const torIds = [...new Set(basicData.map(r => r.tor_id).filter(id => id))]; // Unique TOR IDs

            // 1.2 Fetch Scenarios (Action, Expected Result)
            let scenarioMap = {};
            if (scenarioIds.length > 0) {
                const { data: scData } = await supabaseClient
                    .from('scenarios')
                    .select('id, action, expected_result, information')
                    .in('id', scenarioIds);
                if (scData) {
                    scData.forEach(sc => scenarioMap[sc.id] = sc);
                }
            }

            // 1.3 Fetch TOR Details (Detail Design)
            let torDetailMap = {};
            if (torIds.length > 0) {
                const { data: tdData } = await supabaseClient
                    .from('TORDetail')
                    .select('tor_id, tord_header')
                    .in('tor_id', torIds);
                if (tdData) {
                    tdData.forEach(td => torDetailMap[td.tor_id] = td.tord_header);
                }
            }

            // --- STEP B: BUILD EXCEL ---

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'PCS System';
            workbook.created = new Date();

            const mainModuleName = parseModuleName(basicData[0].module_name).main.toUpperCase().replace(/[^A-Z0-9]/g, '_');

            // 2. Group by Sub-Module
            const subModules = {};
            basicData.forEach(row => {
                const { sub } = parseModuleName(row.module_name);
                const subKey = sub || 'General';
                if (!subModules[subKey]) subModules[subKey] = [];
                subModules[subKey].push(row);
            });

            // 3. Loop Create Sheets
            const subModuleKeys = Object.keys(subModules);
            
            subModuleKeys.forEach((subKey, index) => {
                const rows = subModules[subKey];

                // Naming Sheet (Running Number)
                const prefix = `${index + 1}. `;
                const maxNameLength = 31 - prefix.length;
                const cleanSubKey = subKey.replace(/[:\\\/?*\[\]]/g, '');
                let sheetName = prefix + cleanSubKey.substring(0, maxNameLength);
                if (workbook.getWorksheet(sheetName)) sheetName = sheetName.substring(0, 28) + "_" + (index + 1);

                const worksheet = workbook.addWorksheet(sheetName);

                // --- STYLE CONFIG ---
                worksheet.getColumn('A').width = 35; 
                worksheet.getColumn('B').width = 50; 
                worksheet.getColumn('C').width = 15; 
                worksheet.getColumn('D').width = 50; 
                worksheet.getColumn('E').width = 50; 
                worksheet.getColumn(6).width = 8;
                worksheet.getColumn(7).width = 8; 
                worksheet.getColumn(8).width = 10;
                worksheet.getColumn(9).width = 15; 
                worksheet.getColumn(10).width = 30;

                // Prepare Info
                const firstRow = rows[0];
                const { main, sub } = parseModuleName(firstRow.module_name);
                const pcsModuleName = firstRow.module_name;
                const prototypeUrl = modulePrototypeMap[firstRow.module_id] || "";
                
                // ดึง Detail Design จาก Map ที่เรา Fetch มา (ใช้ tor_id ของแถวแรกเป็นตัวแทน)
                const detailDesignHtml = torDetailMap[firstRow.tor_id] || "-";

                // --- Header Rows 1-5 ---
                const headerRows = [
                    ['Project Name :', 'Port Community System, PORT Authority of Thailand'],
                    ['Application Name :', 'Port Community System'],
                    ['Module :', main], 
                    ['Function :', sub], 
                    ['Path :', pcsModuleName]
                ];

                headerRows.forEach((data, idx) => {
                    const row = worksheet.getRow(idx + 1);
                    row.getCell(1).value = data[0]; 
                    row.getCell(2).value = data[1];
                    
                    const cellA = row.getCell(1);
                    cellA.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    cellA.alignment = { vertical: 'top' };
                    cellA.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    
                    const cellB = row.getCell(2);
                    cellB.alignment = { vertical: 'top', wrapText: true };
                    cellB.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                });

                // --- Row 6 (Detail & Prototype) ---
                const row6 = worksheet.getRow(6);
                
                // Cell A: Label
                const cellA6 = row6.getCell(1);
                cellA6.value = 'Test ID/NAME :'; 
                cellA6.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cellA6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cellA6.alignment = { vertical: 'top' };
                cellA6.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                // Cell B: Sub Module Name (Use as Test ID/NAME context)
                const cellB6 = row6.getCell(2);
                cellB6.value = sub; 
                cellB6.alignment = { vertical: 'top', wrapText: true };
                cellB6.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                // Cell C: Relate Label
                const cellC6 = row6.getCell(3);
                cellC6.value = "สัมพันธ์กับ";
                cellC6.font = { bold: true };
                cellC6.alignment = { vertical: 'top', horizontal: 'center' };
                cellC6.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                // Cell D: Detail Design (Data from Map)
                const cellD6 = row6.getCell(4);
                cellD6.value = { richText: [{ text: 'Detail Design\n', font: { bold: true } }, { text: formatHtmlToExcel(detailDesignHtml) }] };
                cellD6.alignment = { vertical: 'top', wrapText: true };
                cellD6.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                // Cell E: Prototype Link (Hyperlink)
                const cellE6 = row6.getCell(5);
                if (prototypeUrl && prototypeUrl.startsWith('http')) {
                    // 🔥 HYPERLINK FORMAT
                    cellE6.value = {
                        text: 'Click to View Prototype',
                        hyperlink: prototypeUrl,
                        tooltip: 'Open Prototype URL'
                    };
                    cellE6.font = { color: { argb: 'FF0000FF' }, underline: true }; // Blue Link
                } else {
                    cellE6.value = { richText: [{ text: 'Prototype Link\n', font: { bold: true } }, { text: "-" }] };
                }
                cellE6.alignment = { vertical: 'top', wrapText: true };
                cellE6.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                worksheet.addRow([]); // Empty Row 7

                // --- Table Header (Row 8) ---
                const tableHeaders = ['Test Case Name', 'Test Case Function', 'Test Step #', 'Action', 'Expected Result', 'Pass', 'Fail', 'Not Run', 'Test By', 'Remark / Fail Detail'];
                const headerRow = worksheet.addRow(tableHeaders);
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                });

                // --- Data Rows ---
                const tcGroups = {};
                rows.forEach(r => {
                    const tcKey = r.test_case_id || 'Unknown';
                    if(!tcGroups[tcKey]) tcGroups[tcKey] = [];
                    tcGroups[tcKey].push(r);
                });

                Object.values(tcGroups).forEach(tcRows => {
                    tcRows.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));

                    let isFirstScenario = true;
                    tcRows.forEach((sc, idx) => {
                        const row = worksheet.addRow([]);

                        // ดึงข้อมูลลึก (Deep Data) จาก Map ที่เราเตรียมไว้
                        const fullScenario = scenarioMap[sc.scenario_id] || {};
                        const actionText = fullScenario.action || ""; // 🔥 Real Action
                        const expectedText = fullScenario.expected_result || ""; // 🔥 Real Expected
                        const remarkText = fullScenario.information || ""; // 🔥 Real Remark

                        // Col A: Test Case Name
                        if (isFirstScenario) {
                            const moduleNameTitle = sc.module_name || "-"; 
                            row.getCell(1).value = {
                                richText: [
                                    { text: moduleNameTitle + '\n', font: { bold: true } },
                                    { text: (sc.test_id_code || "") + ' :\n', font: { bold: true } },
                                    { text: (sc.test_case_name || ""), font: { bold: false } }
                                ]
                            };
                        } else {
                            row.getCell(1).value = "";
                        }

                        // Col B: Function/Scenario
                        let sessionPrefix = "";
                        const scCode = (sc.scenario_id_code || "").trim();
                        if (scCode.startsWith("ST")) sessionPrefix = "SIT Session\n";
                        else if (scCode.startsWith("UT")) sessionPrefix = "UAT Session\n";

                        row.getCell(2).value = {
                            richText: [
                                { text: sessionPrefix, font: { bold: true } },
                                { text: scCode + ' :\n', font: { bold: true } },
                                { text: (sc.scenario_name || ""), font: { bold: false } }
                            ]
                        };

                        row.getCell(3).value = idx + 1;
                        // Use Formatted Text
                        row.getCell(4).value = formatHtmlToExcel(actionText); // 🔥 Data มาแล้ว
                        row.getCell(5).value = formatHtmlToExcel(expectedText); // 🔥 Data มาแล้ว
                        row.getCell(10).value = formatHtmlToExcel(remarkText);

                        // Borders & Alignment
                        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                            if (colNum > 10) return;
                            cell.alignment = { vertical: 'top', wrapText: true };
                            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                            if ([3, 6, 7, 8].includes(colNum)) {
                                cell.alignment = { vertical: 'top', horizontal: 'center' };
                            }
                        });

                        isFirstScenario = false;
                    });
                });
            });

            // 4. Download File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `Module_${mainModuleName}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`;
            saveAs(blob, fileName);

        } catch (err) {
            console.error("Export Error:", err);
            alert('เกิดข้อผิดพลาดในการ Export: ' + err.message);
        } finally {
            hideLoadingOverlay();
        }
    };
    
    // --- 5. RENDER TABLE (UI Display) ---

    function getPhaseBadgeClass(phaseCode) {
        switch (phaseCode?.toUpperCase()) {
            case 'UNIT': return 'text-bg-secondary';
            case 'SIT': return 'text-bg-warning';  
            case 'UAT': return 'text-bg-primary';  
            default: return 'text-bg-dark';
        }
    }

    function getResultBadge(status) {
        switch (status?.toLowerCase()) {
            case 'passed': return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Passed</span>';
            case 'failed': return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Failed</span>';
            case 'blocked': return '<span class="badge bg-warning text-dark"><i class="bi bi-slash-circle me-1"></i>Blocked</span>';
            case 'skipped': return '<span class="badge bg-secondary">Skipped</span>';
            default: return `<span class="badge bg-light text-secondary border">${status || 'Pending'}</span>`;
        }
    }

    function renderTable(dataToRender) {
        if (!reportTableBody) return;
        if (!dataToRender || dataToRender.length === 0) { 
            reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">No data found matching your criteria.</td></tr>`; 
            return; 
        }

        let html = '';

        for (let i = 0; i < dataToRender.length; i++) {
            const row = dataToRender[i];
            
            // 1. Module Info
            const isFirstRowOfModule = (i === 0) || (dataToRender[i - 1].module_id !== row.module_id);
            html += `<tr>`;

            if (isFirstRowOfModule) {
                let moduleRowSpan = 1;
                for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id; j++) { moduleRowSpan++; }

                const { main, sub } = parseModuleName(row.module_name);
                const mainUpper = main.toUpperCase();

                // Download Button (Circle, Minimal)
                const downloadBtn = `
                    <div class="mt-2">
                        <button class="btn btn-light rounded-circle border shadow-sm d-inline-flex align-items-center justify-content-center" 
                                style="width: 32px; height: 32px; padding: 0;"
                                onclick="exportModuleExcel('${row.module_group}')" 
                                title="Download Test Case" 
                                data-bs-toggle="tooltip">
                            <i class="bi bi-file-earmark-excel-fill text-success" style="opacity: 0.6; font-size: 0.85rem;"></i>
                        </button>
                    </div>`;

                // Prototype Badge
                const protoUrl = modulePrototypeMap[row.module_id];
                const protoDisplay = protoUrl 
                    ? `<div class="mt-2">
                         <a href="${protoUrl}" target="_blank" class="badge bg-info-subtle text-info-emphasis text-decoration-none border border-info-subtle" title="Click to view prototype">
                           <i class="bi bi-window me-1"></i>Prototype
                         </a>
                       </div>` 
                    : '';

                // Col 1: Main Module
                html += `<td rowspan="${moduleRowSpan}" class="align-top bg-white border-end text-center p-3">
                            <div class="fw-bold text-primary text-uppercase mb-1" style="font-size:0.9rem; letter-spacing:0.5px;">${mainUpper}</div>
                            ${downloadBtn}
                         </td>`;
                
                // Col 2: Sub Module
                html += `<td rowspan="${moduleRowSpan}" class="align-top bg-white border-end text-dark p-3" style="font-size:0.9rem;">
                            <div class="fw-medium">${sub}</div>
                            ${protoDisplay}
                         </td>`;
            }

            // 2. Test Objective
            const isFirstRowOfTc = (i === 0) || (dataToRender[i - 1].test_case_id !== row.test_case_id) || (dataToRender[i - 1].module_id !== row.module_id);
            if (isFirstRowOfTc) {
                let tcRowSpan = 1;
                for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id && dataToRender[j].test_case_id === row.test_case_id; j++) { tcRowSpan++; }

                const phase = allTestPhases.find(p => p.id === row.test_phase_id);
                const phaseBadge = phase 
                    ? `<span class="badge ${getPhaseBadgeClass(phase.phase_code)} me-1" style="font-size:0.7rem">${phase.phase_code}</span>` 
                    : '';
                const tcIdBadge = row.test_id_code 
                    ? `<span class="badge bg-light text-dark border me-1" style="font-size:0.7rem; font-weight:600;">${row.test_id_code}</span>` 
                    : '';

                html += `<td rowspan="${tcRowSpan}" class="align-top border-end p-3">
                            <div class="mb-1">${phaseBadge}${tcIdBadge}</div>
                            <div class="fw-medium text-dark" style="font-size:0.9rem;">${row.test_case_name || '-'}</div>
                         </td>`;
            }

            // 3. Test Name (Scenario)
            const scIdBadge = row.scenario_id_code 
                ? `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle me-1" style="font-size:0.75rem;">${row.scenario_id_code}</span>` 
                : '';
            
            const scenarioLink = row.scenario_id 
                ? `<a href="/stk_scendt.html?sc_id=${row.scenario_id}" class="text-primary text-decoration-underline fw-medium" title="View Detail">${row.scenario_name || '-'}</a>` 
                : '-';

            const typeBadge = row.scenario_type 
                ? `<span class="ms-1 text-muted fst-italic small">[${row.scenario_type}]</span>` 
                : '';

            html += `<td class="align-middle p-2">
                        <div style="line-height: 1.6;">${scIdBadge}${scenarioLink}${typeBadge}</div>
                     </td>`;

            // 4. Result
            html += `<td class="text-center align-middle">${getResultBadge(row.result)}</td>`;

            html += `</tr>`;
        }
        reportTableBody.innerHTML = html;
    }

    // --- 5. OPTIONS & INIT ---

    async function populateModuleFilter() {
        if (!moduleFilter) return;
        try {
            const { data } = await supabaseClient.from('MasterOptions').select('option_id, option_label').eq('option_group', 'PCSMODULE').order('display_order').order('option_label');
            moduleFilter.innerHTML = '<option value="all" selected>แสดงทุก Module หลัก</option>';
            data?.forEach(opt => {
                const el = document.createElement('option'); el.value = opt.option_id; el.textContent = opt.option_label; moduleFilter.appendChild(el);
            });
        } catch (e) { console.error(e); }
    }

    async function fetchAllSubModules() {
        try {
            const { data } = await supabaseClient.from('MasterOptions').select('*').eq('option_group', 'PCSSUBMOD').order('display_order');
            allSubModules = data || [];
        } catch (e) { console.error(e); }
    }

    function populateSubModuleFilter(selectedMainId) {
        if (!subModuleFilter) return;
        subModuleFilter.innerHTML = '<option value="all" selected>แสดงทุก Sub Module</option>';
        if (!selectedMainId || selectedMainId === 'all') { subModuleFilter.disabled = true; return; }
        subModuleFilter.disabled = false;
        allSubModules.filter(sub => sub.option_relation === selectedMainId).forEach(opt => {
            const el = document.createElement('option'); el.value = opt.option_id; el.textContent = opt.option_label; subModuleFilter.appendChild(el);
        });
    }

    async function fetchTestPhases() {
        const { data } = await supabaseClient.from('test_phases').select('*').order('display_order');
        allTestPhases = data || [];
        if (phaseFilter) {
            phaseFilter.innerHTML = '<option value="all" selected>All Phases</option>';
            allTestPhases.forEach(p => {
                const el = document.createElement('option'); el.value = p.id; el.textContent = `${p.name} (${p.phase_code})`; phaseFilter.appendChild(el);
            });
        }
    }

    function applyFiltersAndRender() {
        const selModule = moduleFilter?.value || 'all';
        const selSubMod = subModuleFilter?.value || 'all';
        const selPhase = phaseFilter?.value || 'all';
        const selStatus = statusFilter?.value || 'all';

        let filtered = reportViewData;
        if (selModule !== 'all') filtered = filtered.filter(r => r.module_group === selModule);
        if (selSubMod !== 'all') filtered = filtered.filter(r => r.module_subgroup === selSubMod);
        if (selPhase !== 'all') filtered = filtered.filter(r => r.test_phase_id === selPhase);
        if (selStatus !== 'all') filtered = filtered.filter(r => (r.result || 'N/A').toLowerCase() === selStatus.toLowerCase());

        renderTable(filtered);
    }

    async function init() {
        if (typeof supabaseClient === 'undefined') { showError('DB Error'); return; }
        await Promise.all([ populateModuleFilter(), fetchAllSubModules(), fetchTestPhases() ]);
        reportViewData = await fetchData();
        applyFiltersAndRender();

        moduleFilter.addEventListener('change', () => { populateSubModuleFilter(moduleFilter.value); applyFiltersAndRender(); });
        subModuleFilter.addEventListener('change', applyFiltersAndRender);
        phaseFilter.addEventListener('change', applyFiltersAndRender);
        statusFilter.addEventListener('change', applyFiltersAndRender);
    }

    init();
});