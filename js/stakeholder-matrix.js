// =================================================================
// PCS Test Case - Stakeholder Matrix (User View)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const matrixThead = document.getElementById('matrix-thead');
    const matrixTbody = document.getElementById('matrix-tbody');
    const moduleFilter = document.getElementById('module-filter');
    const searchInput = document.getElementById('search-input');

    // Data Stores
    let allGroups = [];
    let allTORs = [];
    let linkSet = new Set(); // เก็บ Key "torId_groupId" เพื่อความเร็วในการเช็ค

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client not found.');
            return;
        }

        try {
            await Promise.all([
                fetchModules(),
                fetchMatrixData()
            ]);
            
            renderMatrix();

        } catch (error) {
            console.error("Init Error:", error);
            matrixTbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger p-5">Failed to load data: ${error.message}</td></tr>`;
        }
    }

    // --- 2. Data Fetching ---

    async function fetchModules() {
        const { data, error } = await supabaseClient
            .from('Modules')
            .select('module_id, module_name')
            .order('module_id');
        
        if (error) throw error;

        data.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.module_id;
            opt.textContent = m.module_name;
            moduleFilter.appendChild(opt);
        });
    }

    async function fetchMatrixData() {
        // 2.1 ดึง Stakeholder Groups (Columns)
        const { data: groups, error: groupError } = await supabaseClient
            .from('stakeholder_groups')
            .select('id, name')
            .order('display_order');
        if (groupError) throw groupError;
        allGroups = groups || [];

        // 2.2 ดึง TORs (Rows)
        const { data: tors, error: torError } = await supabaseClient
            .from('TORs')
            .select('tor_id, tor_name, module_id')
            .order('tor_id');
        if (torError) throw torError;
        allTORs = tors || [];

        // 2.3 ดึง Links (Cells - จุดตัด)
        const { data: links, error: linkError } = await supabaseClient
            .from('stakeholder_tor_links')
            .select('tor_id, group_id');
        if (linkError) throw linkError;

        // แปลง Links เป็น Set เพื่อให้เช็คเร็วๆ O(1)
        // Key format: "TOR_ID|GROUP_ID"
        linkSet.clear();
        links.forEach(l => {
            linkSet.add(`${l.tor_id}|${l.group_id}`);
        });
    }

    // --- 3. Rendering Logic (The Matrix Builder) ---

    function renderMatrix() {
        const modVal = moduleFilter.value;
        const searchVal = searchInput.value.toLowerCase().trim();

        // --- 3.1 Render Header (Columns) ---
        let theadHtml = `
            <tr>
                <th class="col-sticky-1" style="z-index: 30;">No.</th>
                <th class="col-sticky-2" style="z-index: 30;">TOR Description</th>
        `;
        
        allGroups.forEach(g => {
            theadHtml += `<th title="${g.name}" style="min-width: 100px;">
                <div class="text-truncate" style="max-width: 120px;">${g.name}</div>
            </th>`;
        });
        
        theadHtml += `</tr>`;
        matrixThead.innerHTML = theadHtml;

        // --- 3.2 Render Body (Rows) ---
        let tbodyHtml = '';
        let visibleCount = 0;

        allTORs.forEach(tor => {
            // -- Filter Logic --
            if (modVal !== 'all' && tor.module_id !== modVal) return;
            
            if (searchVal) {
                const text = `${tor.tor_id} ${tor.tor_name}`.toLowerCase();
                if (!text.includes(searchVal)) return;
            }

            visibleCount++; // นับลำดับที่แสดงผลจริง

            // สร้าง Row
            tbodyHtml += `<tr>`;
            
            // Col 1: No. (Running Number)
            // แก้ไข: ใช้ visibleCount แทน tor_id และจัดกึ่งกลาง
            tbodyHtml += `<td class="col-sticky-1 text-center text-muted small">${visibleCount}</td>`;
            
            // Col 2: TOR Description (Include TOR Code here)
            // เพิ่ม: เอา tor_id มาใส่ตรงนี้แทน ตัวหนาสีน้ำเงิน
            tbodyHtml += `<td class="col-sticky-2 text-start small">
                <div class="text-dark">${tor.tor_name}</div>
            </td>`;

            // Cols 3..N: Stakeholder Groups Checkmarks
            allGroups.forEach(g => {
                const key = `${tor.tor_id}|${g.id}`;
                const hasLink = linkSet.has(key);
                
                // Highlight ช่องที่มีเครื่องหมายถูกให้เด่นขึ้นนิดนึง
                const bgClass = hasLink ? 'bg-success-subtle' : '';
                
                tbodyHtml += `<td class="matrix-cell">
                    ${hasLink ? '<i class="bi bi-check-circle-fill check-mark text-success"></i>' : ''}
                </td>`;
            });

            tbodyHtml += `</tr>`;
        });

        if (visibleCount === 0) {
            const colspan = 2 + allGroups.length;
            tbodyHtml = `<tr><td colspan="${colspan}" class="text-center p-5 text-muted">ไม่พบข้อมูลตามเงื่อนไขการค้นหา</td></tr>`;
        }

        matrixTbody.innerHTML = tbodyHtml;
    }

    // --- 4. Events ---
    moduleFilter.addEventListener('change', renderMatrix);
    searchInput.addEventListener('input', renderMatrix);

    // Start
    init();
});