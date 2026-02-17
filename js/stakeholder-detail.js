document.addEventListener('DOMContentLoaded', async () => {
    
    // ดึง Group ID จาก URL Parameter
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');

    if (!groupId) {
        alert('ไม่พบรหัสกลุ่ม (Group ID)');
        window.location.href = '/stakeholders.html';
        return;
    }

    const dom = {
        title: document.getElementById('group-name-title'),
        companyContainer: document.getElementById('company-container'),
        moduleContainer: document.getElementById('module-container'),
        loadingComp: document.getElementById('loading-company'),
        loadingMod: document.getElementById('loading-module'),
        emptyComp: document.getElementById('empty-company'),
        emptyMod: document.getElementById('empty-module')
    };

    // --- Init ---
    try {
        await fetchGroupInfo();
        await Promise.all([fetchCompanies(), fetchModuleStats()]);
    } catch (err) {
        console.error(err);
    } finally {
        dom.loadingComp.style.display = 'none';
        dom.loadingMod.style.display = 'none';
    }

    // 1. ดึงชื่อกลุ่ม
    async function fetchGroupInfo() {
        const { data } = await supabaseClient.from('stakeholder_groups').select('name').eq('id', groupId).single();
        if (data) dom.title.textContent = data.name;
    }

    // 2. ดึงรายชื่อบริษัท (สมมติว่ามี Table 'company' ตาม Schema)
    async function fetchCompanies() {
        const { data, error } = await supabaseClient
            .from('stakeholder_company_links')
            .select(`
                company_id,
                company ( * ) 
            `)
            .eq('group_id', groupId);

        if (error) throw error;

        dom.companyContainer.innerHTML = '';
        if (!data || data.length === 0) {
            dom.emptyComp.style.display = 'block';
            return;
        }

        // --- Console Log เพื่อดูชื่อ Field จริงๆ ---
        console.log('Company Data:', data); 

        data.forEach(link => {
            const comp = link.company || {};
            
            // ดึงค่า Field ต่างๆ (เหมือนเดิม)
            const compName = comp.name_th || comp.name_en || comp.company_name || comp.name || 'Unknown Company';
            const addr = comp.address || comp.addr || 'ไม่ระบุที่อยู่';
            const phone = comp.phone || comp.tel || '-';

            // 🔥 HTML ชุดใหม่ (ปรับ Cosmetic)
            const html = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="card shadow-sm border-0 company-card h-100">
                        <div class="card-body d-flex align-items-start gap-3 p-3">
                            
                            <div class="company-icon flex-shrink-0 mt-1" style="width: 35px; height: 35px; font-size: 0.9rem;">
                                <i class="bi bi-building"></i>
                            </div>

                            <div class="flex-grow-1" style="min-width: 0;"> <h6 class="fw-bold mb-1 text-dark" style="font-size: 0.85rem; line-height: 1.4; word-wrap: break-word;">
                                    ${compName}
                                </h6>

                                <div class="text-muted mb-1" style="font-size: 0.75rem; line-height: 1.3; word-wrap: break-word;">
                                    <i class="bi bi-geo-alt me-1 text-secondary"></i>${addr}
                                </div>

                                <div class="text-muted" style="font-size: 0.75rem;">
                                    <i class="bi bi-telephone me-1 text-secondary"></i>${phone}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            `;
            dom.companyContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    // 3. คำนวณสรุป Test Case แยกราย Module (หัวใจสำคัญ)
    async function fetchModuleStats() {
        // Step A: ดึง TOR ที่กลุ่มนี้เกี่ยวข้อง
        const { data: torLinks, error } = await supabaseClient
            .from('stakeholder_tor_links')
            .select(`
                tor_id,
                TORs ( 
                    module_id, 
                    Modules ( module_name ) 
                )
            `)
            .eq('group_id', groupId);

        if (error) throw error;

        if (!torLinks || torLinks.length === 0) {
            dom.emptyMod.style.display = 'block';
            return;
        }

        // Step B: ดึงจำนวน Test Case ของแต่ละ TOR (เพื่อความแม่นยำ)
        // เราจะเอา List ของ TOR ID ที่ได้ ไป query นับ Test Case
        const torIds = torLinks.map(l => l.tor_id);
        
        const { data: tcLinks } = await supabaseClient
            .from('tor_test_case_links')
            .select('tor_id, test_case_id')
            .in('tor_id', torIds);

        // Step C: Grouping & Counting Logic
        // Structure: { 'M001': { name: 'Import', count: 0, id: 'M001' } }
        const moduleStats = {};

        // Map TOR -> Module & Init Stats
        torLinks.forEach(link => {
            const tor = link.TORs;
            if(!tor) return;
            
            const modId = tor.module_id;
            const modName = tor.Modules?.module_name || 'Unknown';

            if (!moduleStats[modId]) {
                moduleStats[modId] = { id: modId, name: modName, tcCount: 0 };
            }
        });

        // Count Test Cases into Modules
        // เราต้องรู้ว่า Test Case นี้อยู่ TOR ไหน -> Module ไหน
        // สร้าง Map ช่วยค้นหา TOR -> Module
        const torToModMap = {};
        torLinks.forEach(link => {
            if(link.TORs) torToModMap[link.tor_id] = link.TORs.module_id;
        });

        if (tcLinks) {
            // นับจำนวน Unique Test Case ต่อ Module
            const uniqueTCs = new Set(); // กันนับซ้ำ (ถ้า 1 TC ผูกหลาย TOR ใน Module เดียวกัน)
            
            tcLinks.forEach(tcLink => {
                const modId = torToModMap[tcLink.tor_id];
                if (modId) {
                    const key = `${modId}-${tcLink.test_case_id}`;
                    if (!uniqueTCs.has(key)) {
                        moduleStats[modId].tcCount++;
                        uniqueTCs.add(key);
                    }
                }
            });
        }

        // Step D: Render Module Cards
        dom.moduleContainer.innerHTML = '';
        const sortedStats = Object.values(moduleStats).sort((a,b) => a.id.localeCompare(b.id));
        const colors = ['#0d6efd'];

        sortedStats.forEach((mod, index) => {
            const color = colors[index % colors.length];
            
            // HTML โครงสร้างใหม่
            const html = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="card h-100 shadow-sm border-0 module-card" 
                         style="border-top-color: ${color};"
                         onclick="window.location.href='/stk_torwtc.html?module=${mod.id}&group=${groupId}'">
                        
                        <div class="card-body d-flex justify-content-between align-items-start gap-3">
                            
                            <div style="flex: 1;"> <h6 class="text-uppercase text-muted small mb-2" style="font-size: 0.65rem; letter-spacing: 0.5px;">
                                    System Module
                                </h6>
                                <div class="module-title" title="${mod.name}">
                                    ${mod.name}
                                </div>
                            </div>

                            <div class="stat-box">
                                <div class="stat-number" style="color: ${color};">
                                    ${mod.tcCount}
                                </div>
                                <div class="stat-label">Test Cases</div>
                            </div>

                        </div>

                        <div class="card-footer bg-white border-0 pt-0 pb-3">
                            <small class="text-muted" style="font-size: 0.75rem;">
                                <i class="bi bi-file-earmark-text me-1"></i>Click to view details
                            </small>
                            <i class="bi bi-chevron-right float-end text-muted small mt-1"></i>
                        </div>
                    </div>
                </div>
            `;
            dom.moduleContainer.insertAdjacentHTML('beforeend', html);
        });
    }
});