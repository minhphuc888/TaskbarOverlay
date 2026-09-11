const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { ipcRenderer } = require('electron');

        const APP_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DrinkWaterApp');
        if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

        const CONFIG_FILE_PATH = path.join(APP_DIR, 'config.json');
        const TRACKING_FILE_PATH = path.join(APP_DIR, 'tracking_data.jsonl');

        const DEFAULT_WATER_TIMES = ["08:30", "09:30", "10:30", "14:00", "15:00", "16:00", "17:00"];

        let appConfig = {
            tabPositionX: 0,
            lunar: { enabled: true, userName: "Gia Chủ", birthDate: "1993-04-10" },
            water: { enabled: true, times: [...DEFAULT_WATER_TIMES] },
            pill: { enabled: true, items: [{ time: "09:00", name: "Vitamin C" }, { time: "14:00", name: "Kẽm" }] },
            weight: { enabled: true, repeatType: "daily", repeatValue: "" },
            reminder: { enabled: true, items: [] }
        };

        const maxTabX = window.screen.width - 480;
        const posSlider = document.getElementById('tab-position-x');
        posSlider.max = maxTabX;

        // UI Logic
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.target).classList.add('active');
                if (tab.dataset.target === 'history-tab') loadHistory();
            });
        });

        function loadConfig() {
            try {
                if (fs.existsSync(CONFIG_FILE_PATH)) {
                    appConfig = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
                }
            } catch (e) {
                console.error(e);
            }

            document.getElementById('toggle-lunar').checked = appConfig.lunar.enabled;
            document.getElementById('lunar-name').value = appConfig.lunar.userName || "";
            document.getElementById('lunar-dob').value = appConfig.lunar.birthDate || "";
            document.getElementById('tab-position-x').value = appConfig.tabPositionX || 0;

            document.getElementById('toggle-water').checked = appConfig.water.enabled;
            renderWaterTimes(appConfig.water.times || []);

            document.getElementById('toggle-pill').checked = appConfig.pill.enabled;
            renderPillItems(appConfig.pill.items || []);

            if (appConfig.weight) {
                document.getElementById('toggle-weight').checked = appConfig.weight.enabled;
                document.getElementById('weight-time').value = appConfig.weight.time || "07:00";
                document.getElementById('weight-repeat-type').value = appConfig.weight.repeatType || "daily";
                document.getElementById('weight-repeat-value').value = appConfig.weight.repeatValue || "";
            }

            if (appConfig.reminder) {
                document.getElementById('toggle-reminder').checked = appConfig.reminder.enabled;
                renderReminderItems(appConfig.reminder.items || []);
            }
        }

        // Water Logic
        function renderWaterTimes(times) {
            const list = document.getElementById('water-times-list');
            list.innerHTML = '';
            times.forEach((t, i) => {
                const tag = document.createElement('div');
                tag.className = 'tag';
                tag.innerHTML = `
                    ${t}
                    <span class="tag-remove" onclick="removeWaterTime(${i})">x</span>
                `;
                list.appendChild(tag);
            });
        }

        function addWaterTime() {
            const val = document.getElementById('new-water-time').value;
            if (!val) return;
            appConfig.water.times.push(val);
            appConfig.water.times.sort();
            renderWaterTimes(appConfig.water.times);
            triggerPreview();
        }

        function removeWaterTime(i) {
            appConfig.water.times.splice(i, 1);
            renderWaterTimes(appConfig.water.times);
            triggerPreview();
        }

        function resetWaterTimes() {
            appConfig.water.times = [...DEFAULT_WATER_TIMES];
            renderWaterTimes(appConfig.water.times);
            triggerPreview();
        }

        // Pill Logic
        function renderPillItems(items) {
            const list = document.getElementById('pill-items-list');
            list.innerHTML = '';
            items.forEach((item, i) => {
                const tag = document.createElement('div');
                tag.className = 'tag';
                tag.innerHTML = `
                    ${item.time} ${item.name}
                    <span class="tag-remove" onclick="removePillItem(${i})">x</span>
                `;
                list.appendChild(tag);
            });
        }

        function addPillItem() {
            const t = document.getElementById('new-pill-time').value;
            const n = document.getElementById('new-pill-name').value;
            if (!t || !n) return;
            appConfig.pill.items.push({ time: t, name: n });
            appConfig.pill.items.sort((a,b) => a.time.localeCompare(b.time));
            renderPillItems(appConfig.pill.items);
            document.getElementById('new-pill-name').value = '';
            triggerPreview();
        }

        function removePillItem(i) {
            appConfig.pill.items.splice(i, 1);
            renderPillItems(appConfig.pill.items);
            triggerPreview();
        }



        function gatherConfig() {
            appConfig.tabPositionX = parseInt(document.getElementById('tab-position-x').value) || 0;
            appConfig.lunar.enabled = document.getElementById('toggle-lunar').checked;
            appConfig.lunar.userName = document.getElementById('lunar-name').value;
            appConfig.lunar.birthDate = document.getElementById('lunar-dob').value;

            appConfig.water.enabled = document.getElementById('toggle-water').checked;
            appConfig.pill.enabled = document.getElementById('toggle-pill').checked;

            appConfig.weight = appConfig.weight || {};
            appConfig.weight.enabled = document.getElementById('toggle-weight').checked;
            appConfig.weight.time = document.getElementById('weight-time').value;
            appConfig.weight.repeatType = document.getElementById('weight-repeat-type').value;
            appConfig.weight.repeatValue = document.getElementById('weight-repeat-value').value;

            appConfig.reminder = appConfig.reminder || {};
            appConfig.reminder.enabled = document.getElementById('toggle-reminder').checked;
        }

        // Reminder Logic
        // Reminder Logic
        function renderReminderItems(items) {
            const list = document.getElementById('reminder-items-list');
            list.innerHTML = '';
            items.forEach((item, i) => {
                const tag = document.createElement('div');
                tag.className = 'tag';
                const repStr = (item.repeatValue ? item.repeatValue + ' ' : '') + item.repeatType;
                tag.innerHTML = `
                    ${item.time} (${repStr}): ${item.name}
                    <span class="tag-remove" onclick="removeReminderItem(${i})">x</span>
                `;
                list.appendChild(tag);
            });
        }

        function addReminderItem() {
            const t = document.getElementById('new-reminder-time').value;
            const rt = document.getElementById('new-reminder-repeat-type').value;
            const rv = document.getElementById('new-reminder-repeat-value').value;
            const n = document.getElementById('new-reminder-name').value;
            if (!t || !n) return;
            
            if (!appConfig.reminder.items) appConfig.reminder.items = [];
            appConfig.reminder.items.push({ time: t, name: n, repeatType: rt, repeatValue: rv });
            renderReminderItems(appConfig.reminder.items);
            
            document.getElementById('new-reminder-name').value = '';
            document.getElementById('new-reminder-repeat-value').value = '';
            triggerPreview();
        }

        function removeReminderItem(i) {
            appConfig.reminder.items.splice(i, 1);
            renderReminderItems(appConfig.reminder.items);
            triggerPreview();
        }

        function triggerPreview() {
            gatherConfig();
            ipcRenderer.send('preview-config', appConfig);
        }

        // Live preview listeners
        document.getElementById('settings-tab').addEventListener('input', triggerPreview);
        document.getElementById('settings-tab').addEventListener('change', triggerPreview);

        // Save Logic
        function saveConfig() {
            gatherConfig();
            try {
                fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(appConfig, null, 4), 'utf8');
                ipcRenderer.send('config-updated');
                window.close();
            } catch (e) {
                alert('Lỗi lưu cấu hình: ' + e.message);
            }
        }

        // History Logic
        function loadHistory() {
            renderHistoryTable('water', 'water-history-body');
            renderHistoryTable('pill', 'pill-history-body');
            renderHistoryTable('reminder', 'reminder-history-body');
            renderWeightHistoryTable();
        }

        function renderWeightHistoryTable() {
            const tbody = document.getElementById('weight-history-body');
            tbody.innerHTML = '';
            try {
                if (fs.existsSync(TRACKING_FILE_PATH)) {
                    const content = fs.readFileSync(TRACKING_FILE_PATH, 'utf8').trim();
                    if (content) {
                        const lines = content.split('\n');
                        const records = lines.map(line => {
                            try { return JSON.parse(line); } catch(e) { return null; }
                        }).filter(Boolean).reverse();
                        
                        let hasData = false;
                        records.forEach(record => {
                            if (record.weight && record.weight.value) {
                                hasData = true;
                                const tr = document.createElement('tr');
                                tr.innerHTML = `<td>${record.date}</td><td><span style="font-weight:bold;">${record.weight.value} kg</span></td>`;
                                tbody.appendChild(tr);
                            }
                        });
                        if (hasData) return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Chưa có dữ liệu lịch sử.</td></tr>';
        }

        function renderHistoryTable(type, tbodyId) {
            const tbody = document.getElementById(tbodyId);
            tbody.innerHTML = '';
            
            try {
                if (fs.existsSync(TRACKING_FILE_PATH)) {
                    const content = fs.readFileSync(TRACKING_FILE_PATH, 'utf8').trim();
                    if (content) {
                        const lines = content.split('\n');
                        const records = lines.map(line => {
                            try { return JSON.parse(line); } catch(e) { return null; }
                        }).filter(Boolean).reverse();
                        
                        if (records.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Chưa có dữ liệu lịch sử.</td></tr>';
                            return;
                        }

                        let hasData = false;
                        records.forEach(record => {
                            const typeData = record[type];
                            if (typeData && typeData.state) {
                                hasData = true;
                                const total = typeData.state.length;
                                const completed = typeData.state.filter(Boolean).length;
                                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                                
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td>${record.date}</td>
                                    <td>
                                        <div style="font-size:12px; margin-bottom:4px;">${completed}/${total} (${percent}%)</div>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${percent}%;"></div>
                                        </div>
                                    </td>
                                    <td>
                                        ${percent === 100 ? '<span style="color:#10b981;font-weight:bold;">Đạt 🎉</span>' : '<span style="color:#ef4444;">Chưa đạt</span>'}
                                    </td>
                                `;
                                tbody.appendChild(tr);
                            }
                        });
                        if (hasData) return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Chưa có dữ liệu lịch sử.</td></tr>';
        }

        // Init
        loadConfig();
